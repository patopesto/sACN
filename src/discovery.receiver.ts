import { Socket, createSocket } from 'dgram';
import { EventEmitter } from 'events';
import { AssertionError } from 'assert';

import { DiscoveryPacket } from './packet';
import { multicastGroup, Payload } from './util';
import { DISCOVERY_INTERVAL } from './constants';

export interface DiscoveryReceiverProps {
  port?: number;
  iface?: string; // local ip address of network interface to use
  reuseAddr?: boolean;
}

export interface Source {
  cid: string;
  sourceName: string;
  sourceAddress?: string;
  lastHeard: Date;
  pages: {
    [page: number]: Payload;
  };
}

export type Sources = { [num: number]: Source };

export declare interface DiscoveryReceiver {
  on(event: 'packet', listener: (packet: DiscoveryPacket) => void): this;
  on(event: 'PacketCorruption', listener: (err: AssertionError) => void): this;
  on(event: 'sourceDetected', listener: (source: Source) => void): this;
  on(event: 'sourceTimeout', listener: (source: Source) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}

export class DiscoveryReceiver extends EventEmitter {
  private socket: Socket;

  private readonly universe = 64214;

  private readonly port: DiscoveryReceiverProps['port'];

  private readonly iface: DiscoveryReceiverProps['iface'];

  private readonly privateSources: Record<string, Source>;

  #sourcesID: Record<string, NodeJS.Timeout | undefined>;

  constructor({
    port = 5568,
    iface = undefined,
    reuseAddr = false,
  }: DiscoveryReceiverProps) {
    super();
    this.port = port;
    this.iface = iface;

    this.socket = createSocket({ type: 'udp4', reuseAddr });
    this.privateSources = {};
    this.#sourcesID = {};

    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = new DiscoveryPacket(msg, rinfo.address);
        const date = new Date();

        // we keep track of sources using CID and address
        const key = packet.cid.toString('utf8') + rinfo.address;

        if (this.privateSources[key]) {
          const source = this.privateSources[key]!;
          source.lastHeard = date;
          if (packet.page === 0) {
            // reset the source's page list
            source.pages = {
              [packet.page]: packet.list,
            };
          } else {
            source.pages[packet.page] = packet.list;
          }
        } else {
          const source: Source = {
            cid: packet.cid.toString('utf8'),
            sourceName: packet.sourceName,
            sourceAddress: packet.sourceAddress,
            lastHeard: date,
            pages: {
              [packet.page]: packet.list,
            },
          };
          this.privateSources[key] = source;
          this.emit('sourceDetected', source);
        }
        this.setSourceTimeout(key);

        this.emit('packet', packet);
      } catch (err) {
        const event =
          err instanceof AssertionError ? 'PacketCorruption' : 'error';
        this.emit(event, err);
      }
    });
    this.socket.bind(this.port, () => {
      try {
        this.socket.addMembership(multicastGroup(this.universe), this.iface);
      } catch (err) {
        this.emit('error', err); // emit errors from socket.addMembership
      }
    });
  }

  public get sources(): Sources {
    const sources: Sources = {};
    let i = 1;
    for (const s in this.privateSources) {
      sources[i] = this.privateSources[s]!;
      i += 1;
    }
    return sources;
  }

  public close(callback?: () => void): this {
    this.socket.close(callback);
    return this;
  }

  private setSourceTimeout(key: string): void {
    if (this.#sourcesID[key] !== undefined) {
      clearTimeout(this.#sourcesID[key]!);
    }
    const timeout = 1000 * (DISCOVERY_INTERVAL + 1); // keeping it safe by adding an extra second
    this.#sourcesID[key] = setTimeout(() => {
      const source = this.privateSources[key];
      this.emit('sourceTimeout', source);
      delete this.privateSources[key];
      delete this.#sourcesID[key];
    }, timeout);
  }
}
