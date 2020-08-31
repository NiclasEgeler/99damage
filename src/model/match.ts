import { ITeam } from "./team";

export interface IMatch {
    matchDate: Date;
    matchName: string;
    leftTeam: ITeam;
    rightTeam: ITeam;
    matchUrl: string;
}