import axios, { AxiosResponse } from "axios";
import { stringify } from "querystring";
import { JsonDB } from "node-json-db";
import * as cheerio from "cheerio";
import { IMatch } from "./model/match";
import { ITeam } from "./model/team";
import { ISeason } from "./model/season";
import { Data } from "./model/ajax.model";
import SteamID = require("steamid");
import { IPlayday } from "./model/playday";
import { ILineup } from "./model/lineup";

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
    public async getCurrentMatch(): Promise<IMatch | null> {
        var match: IMatch;
        var $ = await this.loadSiteWithCookie("https://liga.99damage.de/de/start");
        var userInfo = $(".landing-league-user");
        var currentMatch = userInfo.find("h3:contains(Aktuelles Match)").parent().find(".txt-content a")[0]?.attribs?.href;
        if (currentMatch) {
            match = await Csgo99Damage.getMatchInfo(currentMatch);
        } else {
            return null;
        }
        return match;
    }

    /**
     * getMatchInfo
     * Requires no login
     */
    public static async getMatchInfo(matchUrl: string): Promise<IMatch> {
        var $ = await this.loadSite(matchUrl);
        var matchId = matchUrl.split("/")[6].split("-")[0];
        var result = await axios.get<Data>(`https://liga.99damage.de/ajax/leagues_match?id=${matchId}&action=lineup_get&language=de`);
        var teams = $(".content-match-head-team-titles a");
        var lineups = await this.getLineups(result);
        return {
            matchDate: new Date(+result.data.time * 1000),
            matchName: $(".page-title").find("h1").text(),
            matchUrl,
            leftTeam: await this.getTeamByURL(teams[0].attribs.href),
            rightTeam: await this.getTeamByURL(teams[1].attribs.href),
            leftlineup: lineups.leftTeam,
            rightlineup: lineups.rightTeam
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
     * Gets all the teams from a division.
     * @param division Format: "Div 2.2", "2.2", "1", "Division 2.1", "Starter 1"
     */
    public static async getTeamsByDivision(division: string): Promise<ITeam[] | undefined> {
        var teamUrl: string | undefined;
        var validDivision = /(((Div )|(Division )){0,1}[1-9].[0-9]+)|(Starter [1-9][0-9]{0,})|1/g
        if (!division.match(validDivision)) {
            console.log("Invalid division");
            return undefined;
        }

        var $ = await this.loadSite("https://liga.99damage.de/de/leagues/99dmg")

        if (division.match(/(^1)|((Div|Division) 1)/)) {
            teamUrl = $(`*:contains("Gruppe: Division 1")`).last().children()[0]?.attribs?.href;
        } else if (division.match(/^2|((Div|Division) 2)/)) {
            teamUrl = $(`*:contains("${Csgo99Damage.getDivisionString(division)}")`).last()[0]?.parent?.attribs?.href
        } else {
            if(division.match(/(Starter) ([0-9]?[0-9]|20)$/g)){
                teamUrl = $(`*:contains("${Csgo99Damage.getDivisionString(division)}")`).toArray().filter((e) => e.children[0]?.data === `Starter ${Csgo99Damage.getDivisionString(division)}`)[0]?.attribs?.href
            } else {
                teamUrl = $(`*:contains("${Csgo99Damage.getDivisionString(division)}")`).toArray().filter((e) => e.children[0]?.data === `Division ${Csgo99Damage.getDivisionString(division)}`)[0]?.attribs?.href
            }
        }
        return teamUrl != undefined ? this.getTeamArray(teamUrl) : undefined;
    }

    private static getDivisionString(input: string): string {
        if (input.split(' ')[1]) {
            return input.split(' ')[1];
        } else {
            return input;
        }
    }

    private static async getTeamArray(url: string): Promise<ITeam[]> {
        var teams: ITeam[] = [];
        var divisionsite = await axios.get(url);
        var $ = cheerio.load(divisionsite.data);
        var teamstable = $(".section-content")[0].children[1].children[3].children;
        // Loop through teams and create request.
        var allPromises: Promise<ITeam | undefined>[] = [];
        for (let index = 0; index < teamstable.length; index++) {
            if (teamstable[index].type === "tag") {
                allPromises.push(Csgo99Damage.getTeamByURL(teamstable[index].children[3].children[0].attribs.href));
            }
        }
        var allTeams = await Promise.all(allPromises)
        allTeams.forEach((team) => {
            if (team)
                teams.push(team);
        });
        return teams;
    }

    /**
     * Returns team details.
     * @param url 99damage team url
     * @return `ITeam | undefined` Undefined if the team no longer exists 
     */
    public static async getTeamByURL(url: string): Promise<ITeam | undefined> {
        // Create empty team object
        var team: ITeam = { name: "", rank: 0, players: [], country: "", initial: "" };
        var $ = await this.loadSite(url)


        // Find TeamName
        var name = $("main > .page-title > h1:not(:contains('Team nicht gefunden'))").text();

        // Check if team exists
        if (!name) {
            return undefined;
        }

        // Remove teamShortName f.e. Team ABC (ABC)
        var match = name.match(/(.*)( \(.*\)$)/);
        if (match)
            team.name = match[1];

        // Get team initial and team name
        var initialandname = this.getInitialAndTeamname(name);
        if(initialandname){
            team.name = initialandname[1]
            team.initial = initialandname[0]
        }

        // Set country of the team
        team.country = $(".content-basic-info > li > div:contains('Land')").parent().text().split(':')[1]

        // Get rank of the team in the season and set it
        var rank = $(".wide > .txt-content:contains('Rang')")?.text();
        team.rank = -1;
        if (rank) {
            var match = rank.match(/(Rang: )([0-9]+)/)
            if (match)
                team.rank = +match[2];
        }

        // Get team players
        $(".content-portrait-grid-l > li").each((i, e) => {
            // Loop through players and read info
            var context = $(e);
            // Playername
            var playerName = context.find("h3").text();
            // Season player status
            var inSeasonActive = false;
            var statusText = context.find(".txt-status-positive").text();
            if (statusText && statusText !== "")
                inSeasonActive = true;
            // SteamId
            var playerId = context.find("span[title*='Steam ID']").text().replace("steam", "STEAM");
            // TeamRole
            var teamRole = context.find(".txt-subtitle").text();
            // Add player to team
            team.players.push({ name: playerName, steamId: new SteamID(playerId), inSeasonActive, teamRole });
        });

        return team;
    }

    /**
     * Returns initialName and teamName details.
     * @param teamTitle 99damage team title
     * @return `string[]`
     */
    private static getInitialAndTeamname(teamTitle: string): string[] | undefined {
        var regex = teamTitle.match(/(.*) (\(.*\))/);
        return regex ? [regex[2], regex[1]] : undefined;
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
        var site = await axios.get(url, { validateStatus: () => true });
        var $ = cheerio.load(site.data);
        return $;
    }
}
