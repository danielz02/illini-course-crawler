import { ConnectionConfig, MysqlError, createConnection, FieldInfo } from "mysql";
import {
    convertDBBulkInsertionRecord,
    fetchCourses, fetchDepartments, fetchInstructors, fetchMeetings,
    fetchSectionDBRecords,
    fetchTermRoot,
    parseSubjects
} from "./parser";
import {Meeting, SectionDBRecord, TermRoot} from "./types";

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
    // connection.end(handleError);
}

const bulkInsertionQuery = (query: string, insertionRecords: any[]) => {
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

const writeAll = async (termRootUrl: string) => {
    try {
        const termRootDocument: TermRoot = await fetchTermRoot(termRootUrl);
        const allData = await Promise.all([
            // Populate Subjects Table
            parseSubjects(termRootDocument),
            fetchDepartments(termRootDocument),
            fetchCourses(termRootDocument),
            fetchSectionDBRecords(termRootDocument),
            fetchMeetings(termRootDocument),
            fetchInstructors(termRootDocument)
        ]);
        const bulkInsertionRecords = allData.map(record => convertDBBulkInsertionRecord(record));
        connection.beginTransaction(err => {
            if (err) {
                connection.rollback();
                handleError(err);
            }
            bulkInsertSubjects(bulkInsertionRecords[0]);
            bulkInsertDepartments(bulkInsertionRecords[1]);
            bulkInsertCourses(bulkInsertionRecords[2]);
            bulkInsertSections(bulkInsertionRecords[3]);
            bulkInsertMeetings(bulkInsertionRecords[4]);
            bulkInsertInstructors(bulkInsertionRecords[5]);
            connection.commit(err => {
                if (err) {
                    return connection.rollback(err => {
                        throw err
                    });
                }
                console.log("Transaction committed!");
                connection.end(handleError);
            });
        })
    } catch (e) {
        console.error(`Error in writing course data for ${termRootUrl}`, e);
    }
};

const terms = [
    "https://courses.illinois.edu/cisapp/explorer/schedule/2004/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2005/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2005/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2005/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2006/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2006/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2006/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2007/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2007/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2007/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2008/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2008/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2008/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2009/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2009/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2009/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2010/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2010/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2010/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2011/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2011/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2011/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2012/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2012/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2012/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2013/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2013/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2013/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2014/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2014/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2014/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2015/winter.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2015/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2015/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2015/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2016/winter.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2016/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2016/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2016/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2017/winter.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2017/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2017/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2017/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2018/winter.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2018/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2018/summer.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2018/fall.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2019/winter.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2019/spring.xml",
    "https://courses.illinois.edu/cisapp/explorer/schedule/2019/summer.xml",
]

for (const url of terms) {
    writeAll(`${url}?mode=summary`).then();
}

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
// fetchTermRoot()
//     .then(term => fetchInstructors(term)
//         .then(instructors => bulkInsertInstructors(convertDBBulkInsertionRecord(instructors))));

