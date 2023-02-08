import assert from 'assert';
import { DiscoveryPacket } from '../src/packet';
import { Payload } from '../src/util';
import { discoveryBuff, emptyDiscoveryBuff } from './validBuffer';

const LIST = { 1: 1, 2: 100 };

describe('Discovery Packet', () => {
  it('Correctly sets metadata for a given buffer', () => {
    const packet = new DiscoveryPacket(discoveryBuff, '169.254.7.72');
    assert.strictEqual(packet.page, 0);
    assert.strictEqual(packet.lastPage, 0);
    assert.strictEqual(packet.sourceName, 'Eos Family Console');
    assert.strictEqual(packet.sourceAddress, '169.254.7.72');

    assert.deepStrictEqual(packet.list, LIST);
    const listAsArray = [...(<Buffer>packet.listAsBuffer)];
    assert.deepStrictEqual(listAsArray, [0, 1, 0, 100]); // in network-byte order (Big-Endian)
  });

  it('Returns the same buffer as supplied', () => {
    const packet = new DiscoveryPacket(discoveryBuff);
    assert.deepStrictEqual(packet.buffer, discoveryBuff);
  });

  it('Throws if instantiated with no value', () => {
    assert.throws(() => {
      // @ts-expect-error we're testing if it throws
      // eslint-disable-next-line no-new
      new DiscoveryPacket();
    });
  });

  it('Can create a valid buffer from options', () => {
    const packet = new DiscoveryPacket({
      sourceName: 'Eos Family Console',
      page: 0,
      lastPage: 0,
      universes: LIST,
      cid: Buffer.from([
        108, 128, 156, 144, 110, 119, 64, 25, 169, 55, 218, 194, 232, 86, 66,
        82,
      ]),
    });
    assert.deepStrictEqual(packet.buffer, discoveryBuff);
    assert.deepStrictEqual(packet.listAsBuffer, null); // not available when creating a packet from options
  });

  it('Can accept empty list of universes', () => {
    const packet = new DiscoveryPacket(emptyDiscoveryBuff, '169.254.7.72');

    assert.deepStrictEqual(packet.list, {});
    const listAsArray = [...(<Buffer>packet.listAsBuffer)];
    assert.deepStrictEqual(listAsArray, []);

    const packet2 = new DiscoveryPacket({
      sourceName: 'Eos Family Console',
      universes: {},
      cid: Buffer.from([
        108, 128, 156, 144, 110, 119, 64, 25, 169, 55, 218, 194, 232, 86, 66,
        82,
      ]),
    });
    assert.deepStrictEqual(packet2.buffer, emptyDiscoveryBuff);
  });

  it('Throws if universe list is too long', () => {
    const list: Payload = {};
    for (let i = 1; i <= 513; i += 1) {
      list[i] = i;
    }

    assert.throws(() => {
      // eslint-disable-next-line no-new
      new DiscoveryPacket({
        universes: list,
      });
    });
  });
});
