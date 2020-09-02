import { IPlayer } from "./player";

export interface ITeam {
    name: string;
    players: IPlayer[];
    initial: string;
    country: string;
    rank: number;
}