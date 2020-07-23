export interface TermDBRecord {
    TermId: Term['id'],
    TermName: Term['label'],
    TermDetailUrl: Term['href'],
    CalendarYear: number,
    PublicIndicator: boolean,
    ArchiveIndicator: boolean,
    AttendingTerm: boolean | null,
    DefaultTerm: boolean | null,
    EnrollingTerm: boolean | null
}

export interface Term {
    href: string,
    id: string,
    label: string,
    publicIndicator: string,
    archiveIndicator: string,
    attendingTerm: string | null,
    defaultTerm: string | null,
    enrollingTerm: string | null
}

export interface CalendarYear {
    id: number,
    href: string,
    label: number,
    terms: {
        termDetail: Array<Term> | Term
    }
}

export interface CalendarYears {
    calendarYearSummary: Array<CalendarYear>
}

export interface Schedule {
    label: "Calendar Years",
    calendarYears: CalendarYears
}

export interface YearsRoot {
    schedule: Schedule
}

export interface Subject {
    text: string, // Subject name
    href: string,
    id: string // Subject ID
}

export interface TermRoot {
    term: {
        id: number,
        parents: {
            calendarYear: {
                text: number,
                id: number,
                href: string
            }
        },
        label: string,
        subjects: {
            subject: Array<Subject>
        }
    }
}

/**
 * Incomplete definition of the object parsed from a certain subject endpoint
 */
export interface SubjectRoot {
    subject: {
        parents: {
            calendarYear: {
                text: number,
                id: number,
                href: string
            },
            term: {
                text: string,
                id: number,
                href: string
            }
        },
        id: string, // CS
        label: string, // Computer Science
        collegeCode: string, // KP
        departmentCode: number, // 1434
        unitName: string, // Computer Science
        contactName: string,
        contactTitle: string,
        addressLine1: string,
        addressLine2: string,
        phoneNumber: string,
        webSiteURL: string,
        collegeDepartmentDescription: string,
        cascadingCourses: {
            cascadingCourse: Course[] | Course
        }
    }
}

export interface SubjectDBRecord {
    SubjectID: string,
    SubjectName: string,
    DepartmentCode: number,
    TermID: number
}

/**
 * Department information extracted from SubjectRoot
 * One department could have multiple subjects, thus multiple Department entries.
 * Department information changes with time so departmentCode, termID, and subjectID uniquely identify a department
 */
export interface Department {
    termID: number,
    id: string, // CS
    label: string, // subject name
    collegeCode: string,
    departmentCode: number,
    unitName: string,
    contactName: string,
    contactTitle: string,
    addressLine1: string,
    addressLine2: string,
    phoneNumber: string,
    webSiteURL: string,
    collegeDepartmentDescription: string,
}

export interface DepartmentDBRecord {
    TermID: Department["termID"], // FK
    SubjectID: Department["id"], // PK
    DepartmentName: Department["label"],
    CollegeCode: Department["collegeCode"],
    DepartmentCode: Department["departmentCode"], // PK
    ContactName: Department["contactName"],
    ContactTitle: Department["contactTitle"],
    AddressLine1: Department["addressLine1"],
    AddressLine2: Department["addressLine2"],
    PhoneNumber: Department["phoneNumber"],
    Url: Department["webSiteURL"],
    DepartmentDescription: Department["collegeDepartmentDescription"]
}

export interface Course {
    id: string, // SubjectID and CourseID
    href: string,
    parents: {
        calendarYear: {
            text: number, // Year
            id: number, // Year
            href: string
        },
        term: {
            text: string, // TermName
            id: number, // TermID
            href: string
        },
        subject: {
            text: string, // SubjectName
            id: string, // SubjectID
            href: string
        }
    },
    label: string, // Course Name
    description: string,
    creditHours: string,
    sectionDateRange: string,
    courseSectionInformation: string | null, // Probably prerequisites
    sectionDegreeAttributes: string | null, // GenEd description
    sectionRegistrationNotes: string | null,
    classScheduleInformation: string | null, // Usually information about linked sections
    genEdCategories: { category: GenEd | GenEd[] } | null,
    detailedSections: {
        detailedSection: Section | Section[]
    }
}

export interface CourseDBRecord {
    SubjectID: Course["parents"]["subject"]["id"], // PK, FK
    TermID: Course["parents"]["term"]["id"], // PK, FK
    CourseID: number, // PK
    CourseName: Course["label"],
    CreditHours: Course["creditHours"],
    CourseDescription: Course["description"],
    CourseSectionInformation: Course["classScheduleInformation"],
    SectionDegreeAttributes: Course["sectionDegreeAttributes"],
    SectionRegistrationNotes: Course["sectionRegistrationNotes"],
    ClassScheduleInformation: Course["classScheduleInformation"],
    GenEdCategories: string | null
}

export interface GenEd {
    id: string,
    description: string,
    genEdAttributes: {
        genEdAttribute: {
            text: string,
            code: string
        }
    }
}

export interface Section {
    id: number, // CRN
    href: string, // Section API Endpoint
    parents: {
        calendarYear: {
            text: number, // Year
            id: number, // Year
            href: string
        },
        term: {
            text: string, // TermName
            id: number, // TermID
            href: string
        },
        subject: {
            text: string, // SubjectName
            id: string, // SubjectID
            href: string
        },
        course: {
            text: string, // Course Name
            id: number, // Course Numerical ID
            href: string // Course API Endpoint
        }
    },
    sectionNumber: string,
    statusCode: string,
    sectionText: string | null, // Usually instruction methods and fees
    sectionNotes: string | null, // Usually restrictions
    partOfTerm: string,
    sectionStatusCode: string,
    creditHours: string | null,
    enrollmentStatus: string, // Open, Closed, Restricted, etc.
    sectionCappArea: string | null,
    startDate: string,
    endDate: string,
    meetings: {
        meeting: Meeting | Meeting[]
    }
}

export interface SectionDBRecord {
    CRN: Section["id"] | undefined, // PK
    TermID: Section["parents"]["term"]["id"] | undefined, // PK, FK
    CourseID: Section["parents"]["course"]["id"] | undefined, // FK, 411
    SubjectID: Section["parents"]["subject"]["id"] | undefined, // FK, "CS"
    SectionNumber: Section["sectionNumber"] | undefined, // "AL1"
    Credits: number | null, // Parse from Section["creditHours"]
    StatusCode: Section["statusCode"] | undefined,
    PartOfTerm: Section["partOfTerm"] | undefined,
    EnrollmentStatus: Section["enrollmentStatus"] | undefined,
    SectionText: Section["sectionText"] | undefined, // This course will meet face-to-face at the Farm Credit Building in Sherman, IL
    SectionNotes: Section["sectionNotes"] | undefined, // "Restricted to MBA: (PT) Business Adm -- UIUC or MBA: iMBA Online -UIUC.
    SectionCappArea: Section["sectionCappArea"] | undefined,
    StartDate: Date | undefined,
    EndDate: Date | undefined,
}

export interface Meeting {
    id: number,
    type: {
        text: string, // "Lecture"
        code: string // "LEC"
    },
    start: string, // "9:00AM"
    end: string,
    daysOfTheWeek: string, // "MWF"
    roomNumber: number,
    buildingName: string,
    instructors: {
        instructor: Instructor | Instructor[] | undefined
    }
}

export interface MeetingInfo {
    crn: number,
    termId: number,
    meeting: Meeting
}

export interface MeetingDBRecord {
    CRN: number,
    TermID: number,
    MeetingID: number
    TypeCode: string,
    TypeName: string,
    StartTime: string,
    EndTime: string,
    DaysOfWeek: string,
    BuildingName: string,
    RoomNumber: number
}

export interface Instructor {
    text: string,
    lastName: string,
    firstName: string
}

export interface InstructorInfo {
    crn: number,
    termId: number,
    meetingId: number,
    fullName: string | undefined,
    lastName: string | undefined,
    firstName: string | undefined
}

export interface InstructorDBRecord {
    CRN: number,
    TermID: number,
    MeetingID: number,
    FullName: string | undefined,
    LastName: string | undefined,
    FirstName: string | undefined
}



