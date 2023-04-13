# Development

`npm run watch-ts` will compile the Typescript into Javascript and watch for any changes in the files.

`npm start` will start the server at port 4040

# Debug mode

If you want to debug db queries

```
DEBUG=db npm start
```

# Test

```
npm test
```

This will run all the `.spec.ts` files inside the server directory

# Seed data

## Create seed

`scripts/db/create-seed.sh` will create a seed from local db named production. This will create a `dump.taz.gz`

## Create db

`scripts/db/restore.sh` will restore db from dump.tar.gz
