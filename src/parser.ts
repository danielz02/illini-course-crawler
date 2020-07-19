import fetch from "node-fetch";
import {
    TermDBRecord,
    Term,
    YearsRoot,
    TermRoot,
    SubjectRoot,
    Department,
    SubjectDBRecord,
    DepartmentDBRecord, Course, CourseDBRecord, Subject, GenEd
} from "./types"
import parser, { X2jOptionsOptional } from "fast-xml-parser";

const xmlParserOption: X2jOptionsOptional = {
    attributeNamePrefix: "",
    attrNodeName: false,
    textNodeName : "text",
    ignoreAttributes: false,
    parseAttributeValue: true,
    ignoreNameSpace: true,
    parseNodeValue: true,
    trimValues: true,
};

/**
 * Fetch the raw XML data of academic year and term information from Course Explorer and convert to Json Object.
 */
export const fetchXML = async (url: string): Promise<any> => {
    try {
        const xml = await fetch(url);
        const xmlStr  = await xml.text();
        return parser.validate(xmlStr) ? parser.parse(xmlStr, xmlParserOption) : null;
    } catch(e) {
        console.error("Error while fetching documents", e);
        return null;
    }
};


/**
 * Request the root document of a certain term
 */
export const fetchTermRoot = async (): Promise<TermRoot> => {
    const subjectsEndpointUrl = "https://courses.illinois.edu/cisapp/explorer/schedule/2020/summer.xml?mode=summary";
    return await fetchXML(subjectsEndpointUrl);
};

/**
 * Request the root document (academic years) of the entire course explorer and parse all the available terms into DB records
 */
export const fetchTerms = async () => {
    const yearsEndpointUrl = "https://courses.illinois.edu/cisapp/explorer/schedule.xml?mode=summary";
    const yearsJson = await fetchXML(yearsEndpointUrl);
    return yearsJson ? parseCalendarYears(yearsJson) : null;
};

/**
 * Parse Course Explorer's XML response into DB records from root level to terms.
 * @param years The Json Object converted from Course Explorer's XML response
 */
export const parseCalendarYears = (years: YearsRoot): Array<TermDBRecord> => {
    const calendarYearsArr = years?.schedule.calendarYears.calendarYearSummary.map((year) => (
        year.terms.termDetail instanceof Array ? year.terms.termDetail : year.terms.termDetail
    ));
    return calendarYearsArr.flat(1).map((term: Term) => (
        {
            TermId: term.id,
            TermName: term.label,
            TermDetailUrl: term.href,
            CalendarYear: Number.parseInt(term.label.split(" ")[1]),
            PublicIndicator: term.publicIndicator === "Y",
            ArchiveIndicator: term.archiveIndicator === "Y",
            AttendingTerm: term.attendingTerm ? term.attendingTerm === "Y" : null,
            DefaultTerm: term.defaultTerm ? term.defaultTerm === "Y" : null,
            EnrollingTerm: term.enrollingTerm ? term.attendingTerm === "Y" : null
        }
    ));
};

/**
 * Fetch all the subject information of a single term.
 * @param term The root of a Term document
 */
export const parseSubjects = async (term: TermRoot): Promise<SubjectDBRecord[] | null> => {
    const termId = term.term.id;
    try {
        return await Promise.all(
            term.term.subjects.subject.map(async subject => {
                const departmentInfo = await parseDepartment(subject.href);
                return {
                    SubjectID: subject.id,
                    SubjectName: subject.text,
                    DepartmentCode: departmentInfo.departmentCode,
                    TermID: termId
                }
            })
        );
    } catch (e) {
        console.error("Error in fetching subject information", e);
        return null;
    }
};

/**
 * Fetch all department information of a single semester from Term document (fetched with summary mode) and
 * parse them into DB records for insertion.
 * @param term The root of a Term document
 */
export const fetchDepartments = async (term: TermRoot | null): Promise<DepartmentDBRecord[] | null> => {
    try {
        return term ? await Promise.all(
            term.term.subjects.subject.map(async subject => {
                const subjectDetailUrl = subject.href;
                const departmentInfo =  await parseDepartment(subjectDetailUrl);
                return {
                    TermID: departmentInfo.termID,
                    SubjectID: subject.id,
                    DepartmentName: departmentInfo.label,
                    CollegeCode: departmentInfo.collegeCode,
                    DepartmentCode: departmentInfo.departmentCode,
                    ContactName: departmentInfo.contactName,
                    ContactTitle: departmentInfo.contactTitle,
                    AddressLine1: departmentInfo.addressLine1,
                    AddressLine2: departmentInfo.addressLine2,
                    PhoneNumber: departmentInfo.phoneNumber,
                    Url: departmentInfo.webSiteURL,
                    DepartmentDescription: departmentInfo.collegeDepartmentDescription
                }
            })
        ) : null;
    } catch (e) {
        console.error("Error in fetching department info", e);
        return null;
    }
};

/**
 * Parse department information from a subject document
 * @param endpointUrl The API endpoint of a certain subject
 */
export const parseDepartment = async (endpointUrl: string): Promise<Department> => {
    const subjectRoot: SubjectRoot = await fetchXML(endpointUrl);
    const subjectInfo =  subjectRoot.subject;
    return {
        termID: subjectInfo.parents.term.id,
        id: subjectInfo.id,
        label: subjectInfo.label, // subject name
        collegeCode: subjectInfo.collegeCode,
        departmentCode: subjectInfo.departmentCode,
        unitName: subjectInfo.unitName,
        contactName: subjectInfo.contactName,
        contactTitle: subjectInfo.contactTitle,
        addressLine1: subjectInfo.addressLine1,
        addressLine2: subjectInfo.addressLine2,
        phoneNumber: subjectInfo.phoneNumber,
        webSiteURL: subjectInfo.webSiteURL,
        collegeDepartmentDescription: subjectInfo.collegeDepartmentDescription
    }
};

/**
 * Fetch all the courses under a certain subject in a certain semester
 * @param endpointUrl The API endpoint, in cascade mode, of a certain subject
 */
export const parseCourses = async (endpointUrl: string): Promise<Course[] | Course> => {
    if (!endpointUrl.includes("?mode=cascade")) {
        throw new Error("Must use cascade mode!");
    }
    const subjectRoot: SubjectRoot = await fetchXML(endpointUrl);
    return subjectRoot.subject.cascadingCourses.cascadingCourse;
}

/**
 * Fetch all the courses under all the subjects in a semester and parse them into DB records for later insertion
 * @param term Root of a term document
 */
export const fetchCourses = async (term: TermRoot): Promise<(CourseDBRecord[] | CourseDBRecord)[]> => {
    return Promise.all(
        term.term.subjects.subject.map(async (subject: Subject) => {
            const courseRoot = await parseCourses(`${subject.href}?mode=cascade`);
            if (courseRoot instanceof Array) {
                return Promise.all(
                    courseRoot.map(async (course: Course) => {
                        return {
                            SubjectID: subject.id, // PK, FK
                            TermID: course.parents.term.id, // PK, FK
                            CourseID: Number.parseInt(course.id.split(" ")[1]), // PK
                            CourseName: course.label,
                            CourseDescription: course.description,
                            CourseSectionInformation: course.classScheduleInformation,
                            SectionDegreeAttributes: course.sectionDegreeAttributes,
                            SectionRegistrationNotes: course.sectionRegistrationNotes,
                            ClassScheduleInformation: course.classScheduleInformation,
                            GenEdCategories: genEdStrBuilder(course.genEdCategories?.category)
                        };
                    })
                );
            } else {
                return {
                    SubjectID: subject.id, // PK, FK
                    TermID: courseRoot.parents.term.id, // PK, FK
                    CourseID: Number.parseInt(courseRoot.id.split(" ")[1]), // PK
                    CourseName: courseRoot.label,
                    CourseDescription: courseRoot.description,
                    CourseSectionInformation: courseRoot.classScheduleInformation,
                    SectionDegreeAttributes: courseRoot.sectionDegreeAttributes,
                    SectionRegistrationNotes: courseRoot.sectionRegistrationNotes,
                    ClassScheduleInformation: courseRoot.classScheduleInformation,
                    GenEdCategories: genEdStrBuilder(courseRoot.genEdCategories?.category)
                };
            }
        })
    );
};

/**
 * Encode GenEd arrays into a single string
 * @param genEdInfo A single GenEd Object or an array of GenEds
 */
export const genEdStrBuilder = (genEdInfo: GenEd | GenEd[] | undefined) => {
    let genEdCodes = "";
    if (genEdInfo instanceof Array) {
        genEdInfo.forEach(genEd => {
            genEdCodes += `${genEd.genEdAttributes.genEdAttribute.code}:`;
        });
    } else {
        const genEdAttr = genEdInfo?.genEdAttributes.genEdAttribute;
        genEdCodes += genEdAttr?.code ? `${genEdAttr?.code}:` : "";
    }
    return genEdCodes ? genEdCodes : null;
};

export const convertDBBulkInsertionRecord = (objectArray: any[] | null) => (
    objectArray ? objectArray.map(object => Object.values(object)) : null
);


fetchTerms().then(terms => console.log(convertDBBulkInsertionRecord(terms)));
fetchTermRoot().then(subject => parseSubjects(subject).then(subject => console.log(convertDBBulkInsertionRecord(subject))));
fetchTermRoot().then(termRoot => fetchDepartments(termRoot).then(deptDbRecord => console.log(deptDbRecord)));
fetchTermRoot().then(termRoot => fetchCourses(termRoot).then(courses => console.log(convertDBBulkInsertionRecord(courses.flat(1)))));
