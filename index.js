import Transport from "winston-transport";
import { KafkaClient, HighLevelProducer } from "kafka-node";
import { LEVEL, MESSAGE } from "triple-beam";

const noop = () => {};

const defaults = {
  name: "Winston3KafkaLogger",
  numPerBatch: 1,
  host: "localhost:9092",
  clientId: "winston3-kafka",
  topic: "winston-logs",
};

class KafkaTransport extends Transport {
  constructor(rawOpts = {}) {
    const opts = { ...defaults, ...rawOpts };

    super(opts);

    this.payloads = [];
    this.numPerBatch = opts.numPerBatch;
    this.name = opts.name;
    this.host = opts.host;
    this.topic = opts.topic;
    this.clientId = opts.clientId;
    this.connected = false;
    this.client = new KafkaClient({ kafkaHost: this.host, clientId: this.clientId });
    this.producer = new HighLevelProducer(this.client);
    this.producer
      .on("ready", () => {
        this.connected = true;
      })
      .on("error", err => {
        this.connected = false;
        console.log(err);
        throw new Error("Cannot connect to Kafka server");
      });
  }

  addPayload(message) {
    this.payloads.push({ topic: this.topic, messages: [message] });
  }

  processPayloads() {
    console.log(this.connected);
    if (this.connected && this.payloads.length >= this.numPerBatch) {
      const payloads = this.payloads;
      this.clearPayloads();

      try {
        this.producer.send(payloads, noop);
      } catch (err) {
        console.log(err);
      }
    }
  }

  clearPayloads() {
    this.payloads = [];
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    this.addPayload(info[MESSAGE]);

    this.processPayloads();

    if (callback) {
      callback();
    }
  }
}

export default KafkaTransport;
