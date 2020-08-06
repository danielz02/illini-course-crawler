import fetch from "node-fetch";
import {
    Course,
    CourseDBRecord,
    Department,
    DepartmentDBRecord,
    GenEd,
    Instructor,
    InstructorDBRecord,
    InstructorInfo, InstructorProfile,
    InstructorRating,
    Meeting,
    Section,
    Subject,
    SubjectDBRecord,
    SubjectRoot,
    Term,
    TermDBRecord,
    TermRoot,
    YearsRoot
} from "./types"
import ratings from "./../res/rmp_ratings.json";
import comments from "./../res/rmp_comments.json"
import parser, {X2jOptionsOptional} from "fast-xml-parser";

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
export const fetchTermRoot = async (rootUrl: string): Promise<TermRoot> => {
    return await fetchXML(rootUrl);
};

/**
 * Request the root document (academic years) of the entire course explorer and parse all the available terms into DB records
 */
export const fetchTerms = async (): Promise<TermDBRecord[] | null> => {
    const yearsEndpointUrl = "https://courses.illinois.edu/cisapp/explorer/schedule.xml?mode=summary";
    const yearsJson = await fetchXML(yearsEndpointUrl);
    return yearsJson ? parseCalendarYears(yearsJson) : null;
};

/**
 * Parse Course Explorer's XML response into DB records from root level to terms.
 * @param years The Json Object converted from Course Explorer's XML response
 */
export const parseCalendarYears = (years: YearsRoot): TermDBRecord[] => {
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
};

/**
 * Fetch all the courses under all the subjects in a semester and parse them into DB records for later insertion
 * @param term Root of a term document
 */
export const fetchCourses = async (term: TermRoot): Promise<(CourseDBRecord[] | CourseDBRecord)[] | null> => {
    try {
        const allCourseInfo = await Promise.all(
            term.term.subjects.subject.map(async (subject: Subject) => {
                console.log(`Fetching ${subject.id}: ${subject.text}`);
                const courseRoot = await parseCourses(`${subject.href}?mode=cascade`);
                if (courseRoot instanceof Array) {
                    return await Promise.all(
                        courseRoot.map(async (course: Course) => {
                            return {
                                SubjectID: subject.id, // PK, FK
                                TermID: course.parents.term.id, // PK, FK
                                CourseID: Number.parseInt(course.id.split(" ")[1]), // PK
                                CourseName: course.label,
                                CreditHours: course.creditHours,
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
                        CreditHours: courseRoot.creditHours,
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
        return allCourseInfo.flat(1);
    } catch (e) {
        console.error(`Error in fetching all the courses under ${term.term.label} : ${term.term.id}!`, e);
        return null;
    }
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

/**
 * Parse all the sections under a certain subject of a certain term.
 * For example, all the sections of all CS courses in Summer 2020.
 * @param endpointUrl The API endpoint, in cascade mode, of a certain subject
 */
export const parseSection = async (endpointUrl: string): Promise<Section | Section[] | null> => {
    if (!endpointUrl.includes("?mode=cascade")) {
        throw new Error("Must use cascade mode!");
    }
    try {
        const subjectRoot: SubjectRoot = await fetchXML(endpointUrl);
        const courseInfo = subjectRoot.subject.cascadingCourses.cascadingCourse;
        return courseInfo instanceof Array ?
            courseInfo.map(course => (course.detailedSections.detailedSection)).flat(1) :
            courseInfo.detailedSections.detailedSection;
    } catch (e) {
        console.error(`Error in parsing the section information for ${endpointUrl}`);
        return null;
    }
};

/**
 * Fetch all the sections of all the courses of a certain semester as Javascript Objects
 * @param term The root of the term document as Object
 */
export const fetchSections = async (term: TermRoot): Promise<(Section | null)[] | null> => {
    try {
        const sectionInfo = await Promise.all(
            term.term.subjects.subject.map(async (subject: Subject) => {
                return await parseSection(`${subject.href}?mode=cascade`);
            })
        );
        return sectionInfo.flat(1);
    } catch (e) {
        console.error(`Error in fetching sections of ${term.term.id}: ${term.term.label}!`);
        return null;
    }
};

export const fetchSectionDBRecords = async (term: TermRoot) => {
    try {
        const sectionInfo = await fetchSections(term); // flattened array of all sections
        return sectionInfo?.flatMap(section => {
            const sectionCreditMatch = section?.creditHours?.match(/[0-9]/g)?.[0];
            const sectionCredit = sectionCreditMatch ? Number.parseInt(sectionCreditMatch) : null;
            const startDate = section?.startDate ? new Date(section.startDate) : undefined;
            const endDate = section?.endDate ? new Date(section.endDate) : undefined;
            return {
                CRN: section?.id, // PK
                TermID: section?.parents.term.id, // PK, FK
                CourseID: section?.parents.course.id, // FK, 411
                SubjectID: section?.parents.subject.id, // FK, "CS"
                SectionNumber: section?.sectionNumber ? section?.sectionNumber : null, // "AL1"
                Credits: sectionCredit, // Parse from Section["creditHours"]
                StatusCode: section?.statusCode,
                PartOfTerm: section?.partOfTerm,
                EnrollmentStatus: section?.enrollmentStatus,
                SectionText: section?.sectionText, // This course will meet face-to-face at the Farm Credit Building in Sherman, IL
                SectionNotes: section?.sectionNotes, // "Restricted to MBA: (PT) Business Adm -- UIUC or MBA: iMBA Online -UIUC.
                SectionCappArea: section?.sectionCappArea,
                StartDate: startDate,
                EndDate: endDate,
            }
        });
    } catch (e) {
        console.error(`Error in fetching sections of ${term.term.id}: ${term.term.label}!`);
        return null;
    }
};

export const parseMeetings = (subjectRoot: SubjectRoot) => {
    const subjectCourseInfo = subjectRoot.subject.cascadingCourses.cascadingCourse;
    const meetingInfo = subjectCourseInfo instanceof Array ?
        subjectCourseInfo.flatMap(course => {
            const sectionInfo: Section | Section[] = course.detailedSections.detailedSection;
            return sectionInfo instanceof Array ?
                sectionInfo.flatMap(section => {
                    const sectionMeetingInfo: Meeting | Meeting[] = section.meetings.meeting;
                    return sectionMeetingInfo instanceof Array ?
                        sectionMeetingInfo.map(meeting => (
                            {
                                crn: section.id,
                                termId: section.parents.term.id,
                                meeting: meeting
                            })) :
                        {
                            crn: section.id,
                            termId: section.parents.term.id,
                            meeting: sectionMeetingInfo
                        }
                }) :
                    (
                        sectionInfo.meetings.meeting instanceof Array ?
                            sectionInfo.meetings.meeting.map(meeting => (
                                {
                                    crn: sectionInfo.id,
                                    termId: sectionInfo.parents.term.id,
                                    meeting: meeting
                                }
                            )) :
                            {
                                crn: sectionInfo.id,
                                termId: sectionInfo.parents.term.id,
                                meeting: sectionInfo.meetings.meeting
                            }
                    )
        }) :
        ((subjectCourseInfo.detailedSections.detailedSection) instanceof Array ?
            subjectCourseInfo.detailedSections.detailedSection.flatMap(section => {
                const meetingInfo: Meeting | Meeting[] = section.meetings.meeting;
                return meetingInfo instanceof Array ?
                    meetingInfo.map(meeting => (
                        {
                            crn: section.id,
                            termId: section.parents.term.id,
                            meeting: meeting
                        }
                    )) :
                    {
                        crn: section.id,
                        termId: section.parents.term.id,
                        meeting: meetingInfo
                    }
            }):
            (subjectCourseInfo.detailedSections.detailedSection.meetings.meeting instanceof Array ?
                    subjectCourseInfo.detailedSections.detailedSection.meetings.meeting.map(meeting => {
                        const parentSectionInfo: Section = subjectCourseInfo.detailedSections.detailedSection as Section;
                        return {
                            crn: parentSectionInfo.id,
                            termId: parentSectionInfo.parents.term.id,
                            meeting: meeting,
                        }
                    }) :
                    {
                        crn: subjectCourseInfo.detailedSections.detailedSection.id,
                        termId: subjectCourseInfo.detailedSections.detailedSection.parents.term.id,
                        meeting: subjectCourseInfo.detailedSections.detailedSection.meetings.meeting,
                    }
            ));
    return meetingInfo instanceof Array ? meetingInfo.flat(1) : meetingInfo;
};

export const fetchMeetings = async (term: TermRoot) => {
    try {
        const termMeetingInfo = await Promise.all(term.term.subjects.subject.map(async subject => {
            const subjectRoot: SubjectRoot = await fetchXML(`${subject.href}?mode=cascade`);
            const subjectMeetingInfo = parseMeetings(subjectRoot);
            if (subjectMeetingInfo instanceof Array) {
                return subjectMeetingInfo.map(meeting => (
                    {
                        CRN: meeting.crn,
                        TermID: meeting.termId,
                        MeetingID: meeting.meeting.id,
                        TypeCode: meeting.meeting.type.code,
                        TypeName: meeting.meeting.type.text,
                        StartTime: convertFrom12To24Format(meeting.meeting.start),
                        EndTime: convertFrom12To24Format(meeting.meeting.end),
                        DaysOfWeek: meeting.meeting.daysOfTheWeek,
                        BuildingName: meeting.meeting.buildingName,
                        RoomNumber: meeting.meeting.roomNumber
                    }
                ));
            } else {
                return {
                    CRN: subjectMeetingInfo.crn,
                    TermID: subjectMeetingInfo.termId,
                    MeetingID: subjectMeetingInfo.meeting.id,
                    TypeCode: subjectMeetingInfo.meeting.type.code,
                    TypeName: subjectMeetingInfo.meeting.type.text,
                    StartTime: convertFrom12To24Format(subjectMeetingInfo.meeting.start),
                    EndTime: convertFrom12To24Format(subjectMeetingInfo.meeting.end),
                    DaysOfWeek: subjectMeetingInfo.meeting.daysOfTheWeek,
                    BuildingName: subjectMeetingInfo.meeting.buildingName,
                    RoomNumber: subjectMeetingInfo.meeting.roomNumber
                }
            }
        }))
        return termMeetingInfo.flat(1);
    } catch (e) {
        console.error("Error in fetching meeting information!");
        return null;
    }
};

export const parseInstructors = (subject: SubjectRoot): InstructorInfo | InstructorInfo[] => {
    const meetingInfo = parseMeetings(subject);
    if (meetingInfo instanceof Array) {
        const subjectInstructors = meetingInfo.flatMap(meeting => {
            const instructorInformation: Instructor | Instructor[] | undefined = meeting.meeting.instructors.instructor;
            return instructorInformation instanceof Array ?
                instructorInformation.flatMap(instructor => (
                    {
                        crn: meeting.crn,
                        termId: meeting.termId,
                        meetingId: meeting.meeting.id,
                        fullName: instructor.text,
                        lastName: instructor.lastName,
                        firstName: instructor.firstName
                    }
                )) :
                {
                    crn: meeting.crn,
                    termId: meeting.termId,
                    meetingId: meeting.meeting.id,
                    fullName: instructorInformation?.text,
                    lastName: instructorInformation?.lastName,
                    firstName: instructorInformation?.firstName
                }
        });
        return subjectInstructors.flat(1);
    } else {
        const instructorInformation: Instructor | Instructor[] | undefined = meetingInfo.meeting.instructors.instructor;
        const subjectInstructors = instructorInformation instanceof Array ?
            instructorInformation.flatMap(instructor => (
                {
                    crn: meetingInfo.crn,
                    termId: meetingInfo.termId,
                    meetingId: meetingInfo.meeting.id,
                    fullName: instructor.text,
                    lastName: instructor.lastName,
                    firstName: instructor.firstName
                }
            )) :
            {
                crn: meetingInfo.crn,
                termId: meetingInfo.termId,
                meetingId: meetingInfo.meeting.id,
                fullName: instructorInformation?.text,
                lastName: instructorInformation?.lastName,
                firstName: instructorInformation?.firstName
            };
        return subjectInstructors instanceof Array ? subjectInstructors.flat(1) : subjectInstructors;
    }
};

export const fetchInstructors = async (term: TermRoot): Promise<InstructorDBRecord[] | null> => {
    try {
        const termInstructors = await Promise.all(term.term.subjects.subject.map(async subject => {
            const subjectRoot: SubjectRoot = await fetchXML(`${subject.href}?mode=cascade`);
            return parseInstructors(subjectRoot);
        }));
        return termInstructors.flat(1).map(instructor => (
            {
                CRN: instructor.crn,
                TermID: instructor.termId,
                MeetingID: instructor.meetingId,
                FullName: instructor.fullName,
                LastName: instructor.lastName,
                FirstName: instructor.firstName
            }
        ));
    } catch (e) {
        console.error(`Error in fetching instructor information for ${term.term.label}: ${term.term.id}`, e);
        return null;
    }
};

const convertFrom12To24Format = (time12: string | null) => {
    const matchString = time12?.match(/([0-9]{1,2}):([0-9]{2}) (AM|PM)/)?.slice(1);
    if (matchString) {
        const [sHours, minutes, period] = matchString;
        const PM = period === 'PM';
        const hours = (+sHours % 12) + (PM ? 12 : 0);
        return `${('0' + hours).slice(-2)}:${minutes}`;
    } else {
        return null;
    }
};

export const parseRatings = () => {
    const instructorProfiles: InstructorRating[] = ratings;
    return instructorProfiles.flatMap(instructor => (
        [
            {
                "index": {
                    "_index": "ratings",
                    "_id": instructor.teacher_id
                }
            },
            {
                "teacherID": instructor.teacher_id,
                "numRatings": instructor.number_of_ratings,
                "firstName": instructor.first_name,
                "lastName": instructor.last_name,
                "fullName": `${instructor.first_name} ${instructor.last_name}`,
                "avgRating": instructor.average_ratings
            }
        ]
    ));
};

export const parseComments = () => {
    const commentInfo: any = comments;
    const instructorComments: InstructorProfile[] = commentInfo.comment_by_instructor;
    return instructorComments.flatMap(instructor => (
        instructor.ratings.edges.flatMap(comment => (
            {
                ID: instructor.id,
                LegacyID: instructor.legacyId,
                FirstName: instructor.firstName,
                LastName: instructor.lastName,
                Class: comment.node.class,
                Tags: comment.node.ratingTags,
                IsAttendanceMandatory: comment.node.attendanceMandatory,
                Clarity: comment.node.clarityRating,
                DifficultyRating: comment.node.difficultyRating,
                HelpfulRating: comment.node.helpfulRating,
                WouldTakeAgain: comment.node.wouldTakeAgain,
                IsForCredit: comment.node.isForCredit,
                IsOnline: comment.node.isForOnlineClass,
                Grade: comment.node.grade,
                Comment: comment.node.comment,
                Date: comment.node.date
            }
        ))
    ));
};

export const parseCommentsToEsDocuments = () => {
    const commentInfo: any = comments;
    const instructorComments: InstructorProfile[] = commentInfo.comment_by_instructor;
    return instructorComments.flatMap(instructor => (
        instructor.ratings.edges.flatMap(comment => (
            {
                id: instructor.id,
                legacyID: instructor.legacyId,
                firstName: instructor.firstName,
                lastName: instructor.lastName,
                fullName: `${instructor.firstName} ${instructor.lastName}`,
                class: comment.node.class,
                tags: comment.node.ratingTags,
                isAttendanceMandatory: comment.node.attendanceMandatory === "mandatory",
                clarity: comment.node.clarityRating,
                difficultyRating: comment.node.difficultyRating,
                helpfulRating: comment.node.helpfulRating,
                wouldTakeAgain: comment.node.wouldTakeAgain === 1,
                isForCredit: comment.node.isForCredit,
                isOnline: comment.node.isForOnlineClass,
                grade: comment.node.grade,
                comment: comment.node.comment,
                date: (new Date(comment.node.date)).toISOString()
            }
        ))
    ));
};

export const convertDBBulkInsertionRecord = (objectArray: any[] | null | undefined) => (
    objectArray ? objectArray.map(object => Object.values(object)) : null
);

// const rootUrl = "https://courses.illinois.edu/cisapp/explorer/schedule/2020/spring.xml?mode=summary";
// fetchTerms(rootUrl).then(terms => console.log(convertDBBulkInsertionRecord(terms)));
// fetchTermRoot(rootUrl).then(subject => parseSubjects(subject).then(subject => console.log(convertDBBulkInsertionRecord(subject))));
// fetchTermRoot(rootUrl).then(termRoot => fetchDepartments(termRoot).then(deptDbRecord => console.log(deptDbRecord)));
// fetchTermRoot(rootUrl).then(termRoot => fetchCourses(termRoot).then(courses => console.log((courses))));
// fetchTermRoot(rootUrl).then(termRoot => {
//     fetchSectionDBRecords(termRoot).then(sections => { console.log(sections) });
// });
// fetchTermRoot(rootUrl)
//     .then(term => fetchMeetings(term).then(meetings => console.log(convertDBBulkInsertionRecord(meetings))));

// fetchTermRoot(rootUrl)
//     .then(term => fetchInstructors(term)
//         .then(instructors => console.log(instructors)));
// console.log(parseRatings());

// import { promises as fsPromises } from 'fs';
// fsPromises.writeFile("./parsed-ratings.json", JSON.stringify(parseRatings())).then(r => console.log(r));

// console.log(convertDBBulkInsertionRecord(parseComments()));
