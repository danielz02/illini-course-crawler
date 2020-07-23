import { ConnectionConfig, MysqlError, createConnection, FieldInfo } from "mysql";
import {
    convertDBBulkInsertionRecord,
    fetchCourses, fetchDepartments, fetchInstructors, fetchMeetings,
    fetchSectionDBRecords,
    fetchTermRoot,
    parseSubjects
} from "./parser";
import {Meeting, SectionDBRecord} from "./types";

const mysqlConnectionOption: ConnectionConfig = {
    // ssl: "Amazon RDS",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWD,
    host: process.env.MYSQL_WRITER_HOST,
    database: process.env.MYSQL_DEFAULT_DB
}

const connection = createConnection(mysqlConnectionOption);

const handleError = (err: MysqlError | undefined) => {
    if (err) {
        console.error(err);
        connection.destroy();
    }
};

const handleFields = (fieldsInfo: FieldInfo, index: number) => {
    console.log(`[Field] ${index}: ${Object.values(fieldsInfo)}`);
};

const handleResults = (row: any, index: number) => {
    // uncomment this when any IO is involved
    // connection.pause();
    console.log(`[Result] ${index}: ${Object.values(row)}`);
};

const connectionCleanup = () => {
    console.log(`Cleaning up socket connection to ${process.env.MYSQL_WRITER_HOST}`);
    connection.end(handleError);
}

const bulkInsertionQuery = (query: string, insertionRecords: any[]) => {
    // connection.query(`USE illini_db`, handleError);
    connection
        .query(
            query,
            [insertionRecords]
        )
        .on("error", handleError)
        .on("fields", handleFields)
        .on("result", handleResults)
        .on("end", connectionCleanup)
}

const bulkInsertTerms = (terms: (string | number | boolean | null)[][]) => {
    bulkInsertionQuery(
        `INSERT INTO
                Terms (TermId, TermName, TermDetailUrl, CalendarYear, PublicIndicator, ArchiveIndicator, AttendingTerm, 
                DefaultTerm, EnrollingTerm) VALUES ?`,
        terms
    );
};

const bulkInsertSubjects = (subjects: any[][] | null) => {
    if (subjects) {
        bulkInsertionQuery(
            `INSERT INTO Subjects VALUES ?`,
            subjects
        )
    } else {
        return;
    }
};

const bulkInsertDepartments = (departments: any[][] | null) => {
    departments ? bulkInsertionQuery(
        `INSERT INTO Departments VALUES ?`,
        departments
    ) : null;
};

const bulkInsertCourses = (courses: any[][] | null) => {
    console.log("Bulk inserting courses");
    courses ? bulkInsertionQuery(
        `INSERT INTO Courses VALUES ?`,
        courses
    ) : null;
};

const bulkInsertSections = (sections: any[][] | null) => {
    sections ? bulkInsertionQuery(
        `INSERT INTO Sections VALUES ?`,
        sections
    ) : null;
};

const bulkInsertMeetings = (meetings: any[][] | null) => {
    meetings ? bulkInsertionQuery(
        `INSERT INTO Meetings VALUES ?`,
        meetings
    ) : null;
};

const bulkInsertInstructors = (instructors: any[][] | null) => {
    instructors ? bulkInsertionQuery(
        `INSERT INTO Instructors VALUES ?`,
        instructors
    ) : null;
};

// Connection Test
// connection.connect(handleError);
// connection.end();

// Populate Subjects Table
// fetchTermRoot()
//     .then(termRoot => parseSubjects(termRoot)
//         .then(subjectsArr => bulkInsertSubjects(convertDBBulkInsertionRecord(subjectsArr))));

// Populate Departments Table
// fetchTermRoot()
//     .then(termRoot => fetchDepartments(termRoot)
//         .then(deptDbRecord => bulkInsertDepartments(convertDBBulkInsertionRecord(deptDbRecord))));

// Populate Courses Table
// fetchTermRoot()
//     .then(termRoot => fetchCourses(termRoot)
//         .then(courses => {
//             console.log(courses);
//             bulkInsertCourses(convertDBBulkInsertionRecord(courses));
//         }));

// Populate Sections Table
// fetchTermRoot().then(termRoot => {
//     fetchSectionDBRecords(termRoot)
//         .then(sections => {
//             bulkInsertSections(convertDBBulkInsertionRecord(sections));
//         });
// });

// Populate Meetings Table
// fetchTermRoot()
//     .then(term => fetchMeetings(term)
//         .then(meetings => bulkInsertMeetings(convertDBBulkInsertionRecord(meetings))));

// Populate Instructor Table
fetchTermRoot()
    .then(term => fetchInstructors(term)
        .then(instructors => bulkInsertInstructors(convertDBBulkInsertionRecord(instructors))));

