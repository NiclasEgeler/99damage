import { load } from 'cheerio';
import axios from 'axios';
import { stringify } from 'querystring';
import { rejects } from 'assert';
import { JsonDB } from 'node-json-db';
import { toUnicode } from 'punycode';
import * as cheerio from 'cheerio';
import { resolve } from 'path';
import { IMatch } from './model/match';
import { ITeam } from './model/team';
import { Data } from './model/ajax.model';
import SteamID from 'steamid';


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
                // todo check if key is still valid (parse this stupid date string)
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
        var $ = await this.loadSite('https://liga.99damage.de/de/start');
        var userInfo = $('.landing-league-user');
        var currentMatch = userInfo.find('h3:contains(Aktuelles Match)').parent().find('.txt-content a')[0].attribs.href;
        if (currentMatch)
            match = await this.getMatchInfo(currentMatch);
        else
            throw ('No current match found');
        return match;
    }

    /**
     * getMatchInfo
     * Requires login
     */
    public static async getMatchInfo(url: string): Promise<IMatch> {
        var $ = await this.loadSite(url);
        var title = $('.page-title').find('h1').text();

        var matchId = url.match(/(?<=\/)\d+/);
        var result = await axios.get<Data>(`https://liga.99damage.de/ajax/leagues_match?id=${matchId}&action=lineup_get&language=de`);

        var team1 = '';
        var team2 = '';

        $('.content-match-head-team-titles a').each((index, e) => {
            if (index == 0) {
                if (e.firstChild.firstChild.data) {
                    team1 = e.firstChild.firstChild.data;
                }
            }
            else {
                if (e.firstChild.firstChild.data) {
                    team2 = e.firstChild.firstChild.data;
                }
            }
        });

        var matchDate = new Date(+result.data.time * 1000);

        var leftTeam: ITeam = {
            players: [],
            name: team1
        } as ITeam;
        var rightTeam: ITeam = {
            players: [],
            name: team2
        } as ITeam;

        if (result.data.lineups['1'].length > 0) {
            var lineup = result.data.lineups['2'];
            lineup.forEach(e => {
                var id = (e.gameaccounts[0].replace('steam', 'STEAM'));
                leftTeam.players.push({
                    name: e.name,
                    steamId: new SteamID(id)
                })
            });
        }
        if (result.data.lineups['2'].length > 0) {
            var lineup = result.data.lineups['2'];
            lineup.forEach(e => {
                var id = (e.gameaccounts[0].replace('steam', 'STEAM'));
                rightTeam.players.push({
                    name: e.name,
                    steamId: new SteamID(id)
                })
            });

        }

        return {
            matchDate: matchDate,
            matchName: title,
            matchUrl: url,
            leftTeam: leftTeam,
            rightTeam: rightTeam
        } as IMatch;
    }

    /**
     * getMatchDay     
     * Requires login
     */
    public getMatchDay(day: number) {
        // todo (holt spieltag)
    }

    /**
     * getSeason
     * Requires login
     */
    public getSeason() {
        // todo (holt gesamte Season)
    }

    private static async loadSite(url: string): Promise<CheerioStatic> {
        var site = await axios.get(url, {
            headers: {
                'cookie': `freakms_login_token=${this.token}`
            }
        });
        var $ = cheerio.load(site.data);
        return $;
    }


}
