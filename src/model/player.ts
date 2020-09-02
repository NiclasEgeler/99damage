import SteamID from "steamid";

export interface IPlayer{
    name: string;
    steamId: SteamID;
    inSeasonActive: boolean;
    teamRole: string;
}

//role: Admin, Captain oder player?