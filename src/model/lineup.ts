import { IPlayer } from "./player";
import { ILineupPlayer } from "./lineupplayer";

export interface ILineup{
    rightTeam: ILineupPlayer[];
    leftTeam: ILineupPlayer[];
}