import SteamID from "steamid";

export interface IPlayer{
    name: string;
    steamId: string;
    inSeasonActive: boolean;
    teamRole: string;
}