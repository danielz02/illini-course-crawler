import { Client } from "@elastic/elasticsearch";
import {parseCommentsToEsDocuments} from "./parser";

const client = new Client({ node: process.env.ES_ENDPOINT});

const bulkInsertComments = async () => {
    try {
        const comments = parseCommentsToEsDocuments();
        const body = comments.flatMap(doc => [{ index: { _index: 'comments' } }, doc]);
        const { body: bulkResponse } = await client.bulk({ body });
        return bulkResponse
    } catch (e) {
        console.error("Error in inserting comments", e);
    }
};

bulkInsertComments().then(r => console.log(r?.items?.[0]?.index?.error));
