# 99damage
## A NodeJS API for [liga.99damage.de](http://liga.99damage.de)

[![npm](https://img.shields.io/node/v/99damage.svg?maxAge=604800)](https://www.npmjs.com/package/99damage)
[![npm](https://img.shields.io/npm/dt/99damage.svg?maxAge=604800)](https://www.npmjs.com/package/99damage)
[![npm](https://img.shields.io/npm/dm/99damage.svg?maxAge=604800)](https://www.npmjs.com/package/99damage)

## How to install
```npm install 99damage```

### How to use 
```
import { Csgo99Damage } from "99damage/src/99damage";

Csgo99Damage.login('username', 'passwd').then(() => {

    Csgo99Damage.getCurrentMatch().then(currentMatch => { 
    
    });
    
});
```
