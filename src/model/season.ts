import { IPlayday } from "./playday";
import { ITeam } from "./team";

export interface ISeason {
    season: number;
    division: string;
    playdays: IPlayday[];
    teams: ITeam[];
}