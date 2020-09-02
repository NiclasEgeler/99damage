import { IPlayer } from "./player";

export interface ITeam {
    name: string;
    players: IPlayer[];
    initial: string;
}

//ToDo:
//Teamkürzel
//Teamlanguage (von der Division holen)
//Rank in der aktuellen Season