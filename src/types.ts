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

export interface XMLRoot {
    schedule: Schedule
}
