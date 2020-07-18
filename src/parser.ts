import fetch from "node-fetch";
import { TermDBRecord, Term, XMLRoot } from "./types"
import parser, { X2jOptionsOptional } from "fast-xml-parser";

const xmlParserOption: X2jOptionsOptional = {
    attributeNamePrefix: "",
    attrNodeName: false,
    ignoreAttributes: false,
    parseAttributeValue: true,
    ignoreNameSpace: true,
    parseNodeValue: true,
    trimValues: true,
};

/**
 * Fetch the raw XML data of academic year and term information from Course Explorer and convert to Json Object.
 */
export const fetchYears = async () => {
    try {
        const termXml = await fetch("https://courses.illinois.edu/cisapp/explorer/schedule.xml?mode=summary");
        const termXmlStr  = await termXml.text();
        return parser.validate(termXmlStr) ? parser.parse(termXmlStr, xmlParserOption) : null;
    } catch(e) {
        console.error("Error while fetching documents", e);
    }
}

/**
 * Parse Course Explorer's XML response into DB records from root level to terms.
 * @param years The Json Object converted from Course Explorer's XML response
 */
export const parseCalendarYears = (years: XMLRoot): Array<TermDBRecord> => {
    const calendarYearsArr = years.schedule.calendarYears.calendarYearSummary.map((year) => (
        year.terms.termDetail instanceof Array ? year.terms.termDetail : year.terms.termDetail
    ));
    return calendarYearsArr.flat(1).map((term: Term) => (
        {
            TermId: term.id,
            TermName: term.label,
            TermDetailUrl: term.href,
            CalendarYear: Number.parseInt(term.label.split(" ")[-1]),
            PublicIndicator: term.publicIndicator === "Y",
            ArchiveIndicator: term.archiveIndicator === "Y",
            AttendingTerm: term.attendingTerm ? term.attendingTerm === "Y" : null,
            DefaultTerm: term.defaultTerm ? term.defaultTerm === "Y" : null,
            EnrollingTerm: term.enrollingTerm ? term.attendingTerm === "Y" : null
        }
    ));
};

