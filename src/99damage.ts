import axios, { AxiosResponse } from "axios";
import { stringify } from "querystring";
import { JsonDB } from "node-json-db";
import * as cheerio from "cheerio";
import { IMatch } from "./model/match";
import { ITeam } from "./model/team";
import { ISeason } from "./model/season";
import { Data } from "./model/ajax.model";
import SteamID = require("steamid");
import { IPlayer } from "./model/player";
import { IPlayday } from "./model/playday";
import { ILineup } from "./model/lineup";
import { ILineupPlayer } from "./model/lineupplayer";

export class Csgo99Damage {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    /**
     * login
     */
    public static async login(username: string, password: string): Promise<Csgo99Damage> {
        // Read Key from Db if aviable
        // If key exists
        var token: string;
        var db = new JsonDB("db.json");
        if (db.exists(`/${username}/key`) && db.exists(`/${username}/date`) && new Date(db.getData(`/${username}/date`)) > new Date()) {
            token = db.getData(`/${username}/key`);
            return new Csgo99Damage(token);
        }
        else {
            // request new Key
            var data = {
                type: "login",
                user: username,
                passwd: password,
                language: "de"
            };
            var axiosReturn = await axios.post("https://liga.99damage.de/ajax/gsnet", stringify(data), {
                headers: {
                    "origin": "https://liga.99damage.de",
                    "referer": "https://liga.99damage.de/de/start"
                }
            });
            if (axiosReturn.data?.err) {
                throw (axiosReturn.data.err);
            }
            var sessionInfo = axiosReturn.headers["set-cookie"][1].split(";");
            token = sessionInfo[0].substr(sessionInfo[0].indexOf("=") + 1, sessionInfo[0].length);
            var expireDate = new Date(sessionInfo[1].substr(sessionInfo[1].indexOf("=") + 1, sessionInfo[1].length));
            db.push(`/${username}/key`, token);
            db.push(`/${username}/date`, expireDate);
            return new Csgo99Damage(token);
        }
    }

    /**
     * getCurrentMatch
     * Requires login
     */
    public async getCurrentMatch(): Promise<IMatch> {
        var match: IMatch;
        var $ = await this.loadSiteWithCookie("https://liga.99damage.de/de/start");
        var userInfo = $(".landing-league-user");
        var currentMatch = userInfo.find("h3:contains(Aktuelles Match)").parent().find(".txt-content a")[0]?.attribs?.href;
        if (currentMatch) {
            match = await Csgo99Damage.getMatchInfo(currentMatch);
        } else {
            throw ("No current match found");
        }
        return match;
    }

    /**
     * getMatchInfo
     * Requires no login
     */
    public static async getMatchInfo(matchUrl: string): Promise<IMatch> {
        var $ = await this.loadSite(matchUrl);
        var matchName = $(".page-title").find("h1").text();
        var matchId = matchUrl.split("/")[6].split("-")[0];
        var result = await axios.get<Data>(`https://liga.99damage.de/ajax/leagues_match?id=${matchId}&action=lineup_get&language=de`);
        var teams = $(".content-match-head-team-titles a");
        var leftTeam = await this.getTeamByURL(teams[0].attribs.href);
        var rightTeam = await this.getTeamByURL(teams[1].attribs.href);
        var lineups = await this.getLineups(result);
        var leftlineup: ILineupPlayer[] = lineups.leftTeam;
        var rightlineup: ILineupPlayer[] = lineups.rightTeam;
        var matchDate = new Date(+result.data.time * 1000);
        return {
            matchDate,
            matchName,
            matchUrl,
            leftTeam,
            rightTeam,
            leftlineup,
            rightlineup
        } as IMatch;
    }

    private static async getLineups(ajax: AxiosResponse<Data>): Promise<ILineup> {
        var lineups: ILineup = { rightTeam: [], leftTeam: [] };
        var ready: boolean;
        var standin: boolean;
        var confirmed: boolean;
        const keyArray = ["1", "2"];
        keyArray.forEach((key, i) => {
            ajax.data.lineups[key].forEach((player) => {
                if (player.ready === 0) {
                    ready = false;
                } else {
                    ready = true;
                }
                if (player.standin === 0) {
                    standin = false;
                } else {
                    standin = true;
                }
                if (player.status_stu.msg === "Bestätigter Spieler") {
                    confirmed = true;
                } else {
                    confirmed = false;
                }
                if (i === 0) {
                    lineups.leftTeam.push({ name: player.name, steamId: new SteamID(player.gameaccounts[0].replace("steam", "STEAM")), standin, ready, confirmed });
                } else {
                    lineups.rightTeam.push({ name: player.name, steamId: new SteamID(player.gameaccounts[0].replace("steam", "STEAM")), standin, ready, confirmed });
                }
            });
        });
        return lineups;
    }



    /**
     * getCurrentSeason
     * Requires login
     */
    public async getCurrentSeason(): Promise<ISeason> {
        var season: ISeason;
        var $ = await this.loadSiteWithCookie("https://liga.99damage.de/de/start");
        var userInfo = $(".landing-league-user");
        var divisionURL = userInfo.find("a:contains(Division)")[0]?.attribs?.href;
        if (divisionURL) {
            season = await Csgo99Damage.getSeasonInfoByDivisionURL(divisionURL);
        }
        else {
            throw ("No current division");
        }
        return season;
    }

    /**
     * getSeason
     * Requires no login
     */
    public static async getSeasonInfoByDivisionURL(divisionurl: string): Promise<ISeason> {
        var $ = await this.loadSite(divisionurl);
        var headline = $(".page-title");
        var headlinestring = headline.find("h1:contains(Division)")[0]?.children[0]?.data;
        if (!headlinestring) {
            throw ("No division headline found.");
        }
        var headlinesplit = headlinestring.split(" ");
        var season = +headlinesplit[1].substring(1, headlinesplit[1].length - 1);
        var division = headlinesplit[3];
        var teams = await this.getTeamsByDivision(division);
        var playdays = await this.getAllPlaydaysByDivisionURL(divisionurl);
        return {
            season,
            division,
            playdays,
            teams
        } as ISeason;
    }

    public static async getAllPlaydaysByDivisionURL(url: string): Promise<IPlayday[]> {
        var playdays: IPlayday[] = [];
        var playday: IPlayday = { Matches: [], Playday: 0 };
        var $ = await this.loadSite(url);
        for (let i = 0; i < $("h3").length - 2; i++) {
            var playdaynumber = $("h3")[i].children[0].data?.split(" ")[1];
            if (!playdaynumber) {
                throw ("No playday");
            }
            playday.Playday = +playdaynumber;
            for (let index = 0; index < $("h3")[i].parent.children[3].children[1].children.length; index++) {
                const match = $("h3")[i].parent.children[3].children[1].children[index];
                if (match.type !== "text") {
                    playday.Matches.push(await this.getMatchInfo(match.children[1].children[0].attribs.href));
                }
            }
            playdays.push(playday);
            playday = { Matches: [], Playday: 0 };
        }
        return playdays;
    }

    /**
     * getTeamsByDivision
     * @param division 
     * If starter division "Starter 1" else just ex: "5.1" 
     */
    public static async getTeamsByDivision(division: string): Promise<ITeam[]> {
        var site = await axios.get("https://liga.99damage.de/de/leagues/99dmg");
        var $ = cheerio.load(site.data);
        var link: string = "";
        var selecteddivision: CheerioElement[];
        //Get all Tables
        var sections = $(".content-subsection-toggle");
        //If searched Division is Starter ->
        if (division.includes("Starter")) {
            selecteddivision = $(".content-link-grid")[$(".content-link-grid").length - 1].children;
            link = this.filterdDivision(selecteddivision, division, false);
            //Check if searched Division is above division 2, because of differentials in the table structure
        } else if (+division.split(".")[0] > 2) {
            selecteddivision = sections[+division.split(".")[0] - 1].parent.children[3].children[1].children;
            link = this.filterdDivision(selecteddivision, division, false);
            //Check if its Division 2
        } else if (+division.split(".")[0] === 2) {
            selecteddivision = $(".content-subsection-container").find(".widget-list-boxed")[0].children;
            link = this.filterdDivision(selecteddivision, division, true);
            //Has to be Division 1
        } else {
            link = sections[0].parent.children[3].children[1].children[0].children[1].attribs.href;
        }
        return await this.getTeamArray(link);
    }

    private static filterdDivision(division: CheerioElement[], searcheddivision: string, division2: boolean): string {
        var link: string = "";
        division.some((selecteddivision) => {
            if (division2) {
                if (selecteddivision.name === "li" && selecteddivision?.children[0]?.children[1]?.children[0]?.children[0]?.data?.split(" ")[1] === searcheddivision) {
                    link = selecteddivision.children[0]?.children[1].attribs.href;
                    return true;
                }
            } else {
                if (selecteddivision.name === "li" && selecteddivision?.children[0]?.children[0]?.data?.split(" ")[1] === searcheddivision) {
                    link = selecteddivision.children[0].attribs.href;
                    return true;
                }
            }
        });
        return link;
    }

    private static async getTeamArray(url: string): Promise<ITeam[]> {
        var teams: ITeam[] = [];
        var divisionsite = await axios.get(url);
        var $ = cheerio.load(divisionsite.data);
        var teamstable = $(".section-content")[0].children[1].children[3].children;
        teamstable.forEach(async (team) => {
            if (team.type === "tag") {
                var singleteam = await Csgo99Damage.getTeamByURL(team.children[3].children[0].attribs.href);
                if (singleteam.name !== "Team nicht gefunden") {
                    teams.push(singleteam);
                }
            }
        });
        return teams;
    }

    public static async getTeamByURL(url: string): Promise<ITeam> {
        var team: ITeam = { name: "", rank: 0, players: [], country: "", initial: "" };
        var site = await axios.get(url, { validateStatus: () => true });
        var $ = cheerio.load(site.data);
        var basicinformation = $(".content-basic-info");
        var country = basicinformation.find(".txt-info")[0].parent.children[1].data;
        if (!country) {
            throw ("Country not found.");
        }
        team.country = country;
        var TeamName = $(".page-title");
        var name = TeamName.find("h1")[0].children[0].data;
        if (!name) {
            throw ("Team not found.");
        }
        var divisionurl = $(".content-icon-info")[0].children[1].children[2].attribs.href;
        var divisionsite = await axios.get(divisionurl);
        var $division = cheerio.load(divisionsite.data);
        var teamrank = "";
        $division(".list-section")[0].children[3].children[1].children[3].children.forEach((team) => {
            if (team.type !== "text" && team.children[3].children[0].attribs.href === url) {
                var rank = team.children[1].children[0].children[0].children[0].data;
                if (!rank) {
                    throw ("Rank not found.");
                }
                teamrank = rank.slice(0, rank.length - 1);
            }
        });
        team.rank = +teamrank;
        var InitialAndName = this.getInitialAndTeamname(name.split(" "));
        team.name = InitialAndName[1];
        team.initial = InitialAndName[0];
        var TeamPlayers = $(".content-portrait-grid-l");
        for (let index = 0; index < TeamPlayers.find("li").length - 1; index++) {
            var playernamecheck = TeamPlayers.find("li")[index]?.children[3]?.children[0]?.children[0]?.data;
            var playeridcheck = TeamPlayers.find("li .txt-info")[index]?.children[1]?.children[0]?.data;
            if (!playeridcheck) {
                throw ("Player ID not found.");
            }
            if (!playernamecheck) {
                throw ("Player name not found.");
            }
            var playername = playernamecheck;
            var playerid = playeridcheck;
            var inSeasonActiveString = TeamPlayers.find("li .txt-info")[index].children[4].children[0].data;
            var inSeasonActive: boolean;
            var teamRole = TeamPlayers.find("li .txt-subtitle")[index].children[0].data;
            if (!inSeasonActiveString) {
                throw ("Player activestatus not found");
            }
            if (!teamRole) {
                throw ("Player teamrole not found");
            }
            if (inSeasonActiveString === "Bestätigter Spieler") {
                inSeasonActive = true;
            } else {
                inSeasonActive = false;
            }
            var player: IPlayer = { name: playername, steamId: new SteamID(playerid.replace("steam", "STEAM")), inSeasonActive, teamRole };
            team.players.push(player);
        }
        return team;
    }

    private static getInitialAndTeamname(splittedname: string[]): string[] {
        var initialAndTeamname: string[] = [];
        var Teamname: string = "";
        var Initialname: string = "";
        var initialstart: boolean = false;
        splittedname.forEach((name) => {
            if (name[0] !== "(" && initialstart === false) {
                Teamname += name + " ";
            } else {
                initialstart = true;
                Initialname += name + " ";
            }
        });
        initialAndTeamname.push(Initialname.slice(1, Initialname.length - 2));
        initialAndTeamname.push(Teamname.slice(0, Teamname.length - 1));
        return initialAndTeamname;
    }

    private async loadSiteWithCookie(url: string): Promise<CheerioStatic> {
        var site = await axios.get(url, {
            headers: {
                "cookie": `freakms_login_token=${this.token}`
            }
        });
        var $ = cheerio.load(site.data);
        return $;
    }

    private static async loadSite(url: string): Promise<CheerioStatic> {
        var site = await axios.get(url);
        var $ = cheerio.load(site.data);
        return $;
    }
}
