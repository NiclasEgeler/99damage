import { ITeam } from "./team";
import { ILineupPlayer } from "./lineupplayer";

export interface IMatch {
    matchDate: Date;
    matchName: string;
    leftTeam: ITeam;
    rightTeam: ITeam;
    matchUrl: string;
    leftlineup: ILineupPlayer[];
    rightlineup: ILineupPlayer[];
}