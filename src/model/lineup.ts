import { IPlayer } from "./player";
import { ILineupplayer } from "./lineupplayer";

export interface ILineup{
    rightTeam: ILineupplayer[];
    leftTeam: ILineupplayer[];
}