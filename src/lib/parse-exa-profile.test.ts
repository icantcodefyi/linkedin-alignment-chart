import { parseExaUserString } from "./parse-exa-profile";
import rauchg from "./test_data/results-rauchg.json"

const rauchg_parsed = parseExaUserString(rauchg.data.results[0].text)

const tweets = rauchg_parsed.data?.tweets ?? []

for (const tweet of tweets) {
    console.log(tweet)
}