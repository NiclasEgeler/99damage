import { ITeam } from "./team";
import { ILineupplayer } from "./lineupplayer";

export interface IMatch {
    matchDate: Date;
    matchName: string;
    leftTeam: ITeam;
    rightTeam: ITeam;
    matchUrl: string;
    leftlineup: ILineupplayer[];
    rightlineup: ILineupplayer[];
}