import SteamID = require("steamid");

export interface ILineupPlayer {
    name: string;
    steamId: SteamID;
    standin: boolean;
    confirmed: boolean;
    ready: boolean;
}