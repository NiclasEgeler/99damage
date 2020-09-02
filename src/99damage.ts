import axios, { AxiosResponse } from 'axios';
import { stringify } from 'querystring';
import { JsonDB } from 'node-json-db';
import * as cheerio from 'cheerio';
import { IMatch } from './model/match';
import { ITeam } from './model/team';
import { ISeason } from './model/season'
import { Data } from './model/ajax.model';
import SteamID from 'steamid';
import { IPlayer } from './model/player';
import { IPlayday } from './model/playday';
import { ILineup } from './model/lineup';
import { ILineupplayer } from './model/lineupplayer';

export class Csgo99Damage {

    private static token: string;

    /**
     * login
     */
    public static async login(username: string, password: string): Promise<undefined> {
        return new Promise<undefined>((resolve, reject) => {
            // Read Key from Db if aviable
            // If key exists
            var db = new JsonDB('db.json');
            if (db.exists(`/${username}/key`)) {
                // todo check if key is still valid 
                // return key
                this.token = db.getData(`/${username}/key`);
                resolve();
            }
            else {
                // request new Key
                var data = {
                    type: 'login',
                    user: username,
                    passwd: password,
                    language: 'de'
                };
                axios.post('https://liga.99damage.de/ajax/gsnet', stringify(data), {
                    headers: {
                        'origin': 'https://liga.99damage.de',
                        'referer': 'https://liga.99damage.de/de/start'
                    }
                }).then(e => {
                    if (e.data?.err) {
                        reject(e.data.err);
                    }
                    var sessionInfo = e.headers['set-cookie'][1].split(';');
                    var token = sessionInfo[0].substr(sessionInfo[0].indexOf('=') + 1, sessionInfo[0].length)
                    var expireDate = new Date(sessionInfo[1].substr(sessionInfo[1].indexOf('=') + 1, sessionInfo[1].length))
                    db.push(`/${username}/key`, token);
                    db.push(`/${username}/date`, expireDate);
                    this.token = token;
                    resolve();

                }).catch(e => {
                    console.log(e);
                    reject('Unknown login error')
                });
            }
        });
    }

    /**
     * getCurrentMatch
     * Requires login
     */
    public static async getCurrentMatch(): Promise<IMatch> {
        var match: IMatch;
        var $ = await this.loadSiteWithCookie('https://liga.99damage.de/de/start');
        var userInfo = $('.landing-league-user');
        var currentMatch = userInfo.find('h3:contains(Aktuelles Match)').parent().find('.txt-content a')[0]?.attribs?.href;
        if (currentMatch)
            match = await this.getMatchInfo(currentMatch);
        else
            throw ('No current match found');
        return match;
    }

    /**
     * getMatchInfo
     * Requires no login
     */
    public static async getMatchInfo(url: string): Promise<IMatch> {
        var $ = await this.loadSite(url);
        var title = $('.page-title').find('h1').text();
        var matchId = url.match(/(?<=\/)\d+/);
        var result = await axios.get<Data>(`https://liga.99damage.de/ajax/leagues_match?id=${matchId}&action=lineup_get&language=de`);
        var teams = $('.content-match-head-team-titles a')
        var leftTeam = await this.getTeamByURL(teams[0].attribs.href)
        var rightTeam = await this.getTeamByURL(teams[1].attribs.href)
        var lineups = await this.getLineups(result, $)
        var leftlineup: ILineupplayer[] = lineups.leftTeam
        var rightlineup: ILineupplayer[] = lineups.rightTeam
        var matchDate = new Date(+result.data.time * 1000);
        return {
            matchDate: matchDate,
            matchName: title,
            matchUrl: url,
            leftTeam: leftTeam,
            rightTeam: rightTeam,
            leftlineup,
            rightlineup
        } as IMatch;
    }

    private static async getLineups(ajax: AxiosResponse<Data>, $: CheerioStatic):Promise<ILineup>{
        var lineups: ILineup = {rightTeam: [], leftTeam: []};
        for (let index = 0; index < ajax.data.lineups['1'].length; index++) {
            var ready:boolean;
            var standin:boolean;
            var confirmed:boolean;
            if (ajax.data.lineups['1'][index].ready == 0) {
                ready = false;
            } else {
                ready = true;
            }
            if (ajax.data.lineups['1'][index].standin == 0) {
                standin = false;
            } else {
                standin = true;
            }
            if (ajax.data.lineups['1'][index].status_stu.msg == "Bestätigter Spieler") {
                confirmed = true
            } else {
                confirmed = false
            }
            lineups.leftTeam.push({name: ajax.data.lineups['1'][index].name, steamId: new SteamID(ajax.data.lineups['1'][index].gameaccounts[0].replace('steam', 'STEAM')), standin, ready, confirmed})
        }

        for (let index = 0; index < ajax.data.lineups['2'].length; index++) {
            var ready:boolean;
            var standin:boolean;
            var confirmed:boolean;
            if (ajax.data.lineups['2'][index].ready == 0) {
                ready = false;
            } else {
                ready = true;
            }
            if (ajax.data.lineups['2'][index].standin == 0) {
                standin = false;
            } else {
                standin = true;
            }
            if (ajax.data.lineups['2'][index].status_stu.msg == "Bestätigter Spieler") {
                confirmed = true
            } else {
                confirmed = false
            }
            lineups.rightTeam.push({name: ajax.data.lineups['2'][index].name, steamId: new SteamID(ajax.data.lineups['2'][index].gameaccounts[0].replace('steam', 'STEAM')), standin, ready, confirmed})
        }
        return lineups
    }

    /**
     * getCurrentSeason
     * Requires login
     */
    public static async getCurrentSeason(): Promise<ISeason> {
        var season: ISeason;
        var $ = await this.loadSiteWithCookie('https://liga.99damage.de/de/start')
        var userInfo = $('.landing-league-user');
        var divisionURL = userInfo.find('a:contains(Division)')[0]?.attribs?.href
        if (divisionURL) {
            season = await this.getSeasonInfoByDivisionURL(divisionURL);
        }
        else
            throw ('No current division');
        return season;
    }

    /**
     * getSeason
     * Requires no login
     */
    public static async getSeasonInfoByDivisionURL(divisionurl: string): Promise<ISeason> {
        var $ = await this.loadSiteWithCookie(divisionurl)
        var headline = $('.page-title')
        var headlinestring = headline.find('h1:contains(Division)')[0]?.children[0]?.data
        if (headlinestring == undefined) {
            throw ("No division headline found.")
        }
        var headlinesplit = headlinestring.split(' ')
        var season = +headlinesplit[1].substring(1, headlinesplit[1].length - 1)
        var division = headlinesplit[3]
        var teams = await this.getTeamsByDivision(division)
        var playdays = await this.getAllPlaydaysByDivisionURL(divisionurl)
        return {
            season,
            division,
            playdays,
            teams
        } as ISeason
    }

    public static async getAllPlaydaysByDivisionURL(url: string): Promise<IPlayday[]> {
        var playdays: IPlayday[] = [];
        var $ = await this.loadSite(url)
        for (let i = 0; i < $('h3').length - 2; i++) {
            var playday: IPlayday = { Matches: [], Playday: 0 }
            var playdaynumber = $('h3')[i].children[0].data?.split(' ')[1]
            if (!playdaynumber) {
                throw ('No playday')
            }
            playday.Playday = +playdaynumber
            playday.Matches.push(await this.getMatchInfo($('h3')[i].parent.children[3].children[1].children[1].children[1].children[0].attribs.href))
            playdays.push(playday)
        }
        return playdays
    }

    /**
     * getTeamsByDivision
     * @param division 
     * If starter division "Starter 1" else just ex: "5.1" 
     */
    public static async getTeamsByDivision(division: string): Promise<ITeam[]> {
        var teams: ITeam[] = []
        var site = await axios.get('https://liga.99damage.de/de/leagues/99dmg')
        var $ = cheerio.load(site.data)
        var sections = $('.content-subsection-toggle')
        if (division.includes("Starter")) {
            var starter = sections[sections.length - 1].parent.children[3].children[1].children
            for (let index = 0; index < starter.length; index++) {
                if (starter[index].name) {
                    if (division == starter[index].children[0].children[0].data) {
                        var divisionsite = await axios.get(starter[index].children[0].children[0].parent.attribs.href)
                        $ = cheerio.load(divisionsite.data)
                        var teamstable = $('.section-content')[0].children[1].children[3].children
                        for (let i = 0; i < teamstable.length; i++) {
                            if (teamstable[i].type == "tag") {
                                var singleteam = await this.getTeamByURL(teamstable[i].children[3].children[0].attribs.href)
                                if (singleteam.name != "Team nicht gefunden") {
                                    teams.push(singleteam)
                                }
                            }
                        }
                    }
                }
            }
        } else if (+division.split('.')[0] > 2) {
            for (let index = 0; index < sections.length; index++) {
                if (sections[index].children[0].data?.split(' ')[1] == division.split('.')[0]) {
                    var divisions = sections[index].parent.children[3].children[1].children
                    for (let i = 0; i < divisions.length; i++) {
                        if (divisions[i].name == "li") {
                            if (divisions[i].children[0].children[0].data?.split(' ')[1] == division) {
                                var divisionsite = await axios.get(divisions[i].children[0].attribs.href)
                                $ = cheerio.load(divisionsite.data)
                                var teamstable = $('.section-content')[0].children[1].children[3].children
                                for (let i = 0; i < teamstable.length; i++) {
                                    if (teamstable[i].type == "tag") {
                                        var singleteam = await this.getTeamByURL(teamstable[i].children[3].children[0].attribs.href)
                                        if (singleteam.name != "Team nicht gefunden") {
                                            teams.push(singleteam)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (+division.split('.')[0] == 2) {
            for (let i = 0; i < sections[1].parent.children[3].children[1].children.length; i++) {
                if (sections[1].parent.children[3].children[1].children[i].type != "text") {
                    if (sections[1].parent.children[3].children[1].children[i].children[0].children[1].children[0].children[0].data?.split(' ')[1] == division) {
                        var divisionsite = await axios.get(sections[1].parent.children[3].children[1].children[i].children[0].children[1].attribs.href)
                        $ = cheerio.load(divisionsite.data)
                        var teamstable = $('.section-content')[0].children[1].children[3].children
                        for (let i = 0; i < teamstable.length; i++) {
                            if (teamstable[i].type == "tag") {
                                var singleteam = await this.getTeamByURL(teamstable[i].children[3].children[0].attribs.href)
                                if (singleteam.name != "Team nicht gefunden") {
                                    teams.push(singleteam)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            var divisionsite = await axios.get(sections[0].parent.children[3].children[1].children[0].children[1].attribs.href)
            $ = cheerio.load(divisionsite.data)
            var teamstable = $('.section-content')[0].children[1].children[3].children
            for (let i = 0; i < teamstable.length; i++) {
                if (teamstable[i].type == "tag") {
                    var singleteam = await this.getTeamByURL(teamstable[i].children[3].children[0].attribs.href)
                    if (singleteam.name != "Team nicht gefunden") {
                        teams.push(singleteam)
                    }
                }
            }
        }
        return teams
    }

    public static async getTeamByURL(url: string): Promise<ITeam> {
        var team: ITeam = { name: "", rank: 0, players: [], country: "", initial: "" }
        var site = await axios.get(url, { validateStatus: () => true })
        var $ = cheerio.load(site.data)
        var basicinformation = $('.content-basic-info')
        var country = basicinformation.find('.txt-info')[0].parent.children[1].data
        if (!country) {
            throw ('Country not found.')
        }
        team.country = country
        var TeamName = $('.page-title')
        var name = TeamName.find('h1')[0].children[0].data
        if (name == undefined) {
            throw ('Team not found.')
        }
        var divisionurl = $('.content-icon-info')[0].children[1].children[2].attribs.href
        var divisionsite = await axios.get(divisionurl)
        var $division = cheerio.load(divisionsite.data)
        var teamrank = ""
        for (let v = 0; v < $division('.list-section')[0].children[3].children[1].children[3].children.length; v++) {
            if ($division('.list-section')[0].children[3].children[1].children[3].children[v].type != "text") {
                if ($division('.list-section')[0].children[3].children[1].children[3].children[v].children[3].children[0].attribs.href == url) {
                    var rank = $division('.list-section')[0].children[3].children[1].children[3].children[v].children[1].children[0].children[0].children[0].data
                    if (!rank) {
                        throw ('Rank not found.')
                    }
                    teamrank = rank.slice(0, rank.length - 1)
                }
            }
        }
        team.rank = +teamrank
        var InitialAndName = this.getInitialAndTeamname(name.split(' '))
        team.name = InitialAndName[1]
        team.initial = InitialAndName[0]
        var TeamPlayers = $('.content-portrait-grid-l')
        for (let index = 0; index < TeamPlayers.find('li').length - 1; index++) {
            var playernamecheck = TeamPlayers.find('li')[index]?.children[3]?.children[0]?.children[0]?.data
            var playeridcheck = TeamPlayers.find('li .txt-info')[index]?.children[1]?.children[0]?.data
            if (playeridcheck == undefined) {
                throw ('Player ID not found.')
            }
            if (playernamecheck == undefined) {
                throw ('Player name not found.')
            }
            var playername = playernamecheck
            var playerid = playeridcheck
            var inSeasonActiveString = TeamPlayers.find('li .txt-info')[index].children[4].children[0].data
            var inSeasonActive: boolean;
            var teamRole = TeamPlayers.find('li .txt-subtitle')[index].children[0].data
            if (!inSeasonActiveString) {
                throw ("Player activestatus not found")
            }
            if (!teamRole) {
                throw ("Player teamrole not found")
            }
            if (inSeasonActiveString == "Bestätigter Spieler") {
                inSeasonActive = true
            } else {
                inSeasonActive = false
            }
            var player: IPlayer = { name: playername, steamId: new SteamID(playerid.replace('steam', 'STEAM')), inSeasonActive, teamRole }
            team.players.push(player)
        }
        return team
    }

    private static getInitialAndTeamname(splittedname: string[]): string[] {
        var initialAndTeamname: string[] = [];
        var Teamname: string = ""
        var Initialname: string = ""
        var initialstart: boolean = false
        for (let index = 0; index < splittedname.length; index++) {
            if (splittedname[index][0] != '(' && initialstart == false) {
                Teamname += splittedname[index] + " "
            } else {
                initialstart = true
                Initialname += splittedname[index] + " "
            }
        }
        initialAndTeamname.push(Initialname.slice(1, Initialname.length - 2))
        initialAndTeamname.push(Teamname.slice(0, Teamname.length - 1))
        return initialAndTeamname
    }

    private static async loadSiteWithCookie(url: string): Promise<CheerioStatic> {
        var site = await axios.get(url, {
            headers: {
                'cookie': `freakms_login_token=${this.token}`
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
