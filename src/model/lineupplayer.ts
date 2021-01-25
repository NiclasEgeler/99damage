import SteamID = require("steamid");

export interface ILineupPlayer {
    name: string;
    steamId: string;
    standin: boolean;
    confirmed: boolean;
    ready: boolean;
}