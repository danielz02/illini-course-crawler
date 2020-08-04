import { Client } from "@elastic/elasticsearch";
import AWS from "aws-sdk";

AWS.config.update


const client = new Client({ node: process.env.ES_ENDPOINT});
// callback API
client.search({
    index: 'my-index',
    body: {
        query: {
            match: { hello: 'world' }
        }
    }
}, (err, result) => {
    if (err) console.log(err)
})
