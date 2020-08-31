export interface Data {
    match_id: number;
    status: string;
    time: number;
    score_1: number;
    score_2: number;
    user_relation: string;
    lineups: { [key: string]: Lineup[] };
    lineups_readyup_enabled: number;
    lineup_readyup_time: number;
}

export interface Lineup {
    id: number;
    name: string;
    link: string;
    picture: string;
    ready: number;
    standin: number;
    gameaccounts: string[];
    status_stu: StatusStu;
}

export interface StatusStu {
    status: number;
    key: string;
    msg: string;
}

