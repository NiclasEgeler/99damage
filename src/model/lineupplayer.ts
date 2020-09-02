import SteamID from "steamid";

export interface ILineupplayer{
    name: string;
    steamId: SteamID;
    standin: boolean;
    confirmed: boolean;
    ready: boolean;
}