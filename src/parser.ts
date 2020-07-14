import { writeFile } from 'fs';
import fetch from 'node-fetch';
import parser, {X2jOptions, X2jOptionsOptional} from "fast-xml-parser";

const xmlParserOption: X2jOptionsOptional = {
    attributeNamePrefix: "",
    attrNodeName: false,
    ignoreAttributes: false,
    ignoreNameSpace: true,
};

export const parseTerm = async () => {
    try {
        const termXml = await fetch("https://courses.illinois.edu/cisapp/explorer/schedule.xml?mode=summary");
        const termXmlStr  = await termXml.text();
        console.log(termXmlStr);
        return parser.validate(termXmlStr) ? parser.parse(termXmlStr, xmlParserOption) : null;
    } catch(e) {
        console.error("Error while fetching documents", e);
    }
}

parseTerm()
    .then(terms => {
        terms.schedule.calendarYears.calendarYearSummary.forEach((year: {
            id: number;
            terms: {termDetail: any}; }) => {
            console.log(year);
            year.terms.termDetail.forEach((term: {id: string}) => {
                console.log({
                    CalendarYear: year.id,
                    Term: term
                })
            })
        })
    })
    .catch(err => console.error(err));

