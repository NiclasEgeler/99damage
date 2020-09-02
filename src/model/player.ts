import SteamID from "steamid";

export interface IPlayer{
    name: string;
    steamId: SteamID;
    inSeasonActive: boolean;
    teamRole: string;
}