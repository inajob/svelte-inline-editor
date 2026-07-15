import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { WSSharedDoc } from '../types.js';
import { isOfflineConflict, concatenateDocuments, getYDoc } from '../document-manager.js';

export function handleSyncMessage(
  message: Uint8Array,
  decoder: decoding.Decoder,
  encoder: encoding.Encoder,
  doc: WSSharedDoc,
  replyEncoder: encoding.Encoder
): void {
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case 0: {
      syncProtocol.readSyncStep1(decoder, encoder, doc);
      break;
    }
    case 1: {
      syncProtocol.readSyncStep2(decoder, doc, 'server');
      break;
    }
    case 2: {
      syncProtocol.readUpdate(decoder, doc, 'server');
      break;
    }
  }
}

export function handleSyncStep1(
  clientStateVector: Uint8Array,
  doc: WSSharedDoc
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);

  const tempDoc = new Y.Doc();
  try {
    Y.applyUpdate(tempDoc, Y.encodeStateAsUpdate(doc));

    if (isOfflineConflict(doc, clientStateVector)) {
      Y.applyUpdate(tempDoc, Y.encodeStateAsUpdate(tempDoc, clientStateVector));

      const mergedDoc = concatenateDocuments(doc, tempDoc);
      const mergedUpdate = Y.encodeStateAsUpdate(mergedDoc);

      Y.transact(doc, () => {
        Y.applyUpdate(doc, mergedUpdate);
      });

      syncProtocol.writeSyncStep2(encoder, doc, clientStateVector);

      mergedDoc.destroy();
    } else {
      syncProtocol.writeSyncStep2(encoder, doc, clientStateVector);
    }
  } finally {
    tempDoc.destroy();
  }

  return encoding.toUint8Array(encoder);
}

export function handleSyncStep2(
  update: Uint8Array,
  doc: WSSharedDoc
): void {
  Y.applyUpdate(doc, update, 'remote');
}
