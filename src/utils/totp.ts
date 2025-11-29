
export async function generateTOTP(secret: string, windowSize = 30): Promise<string> {
    console.log('[TOTP] Generating TOTP for secret:', secret);
    console.log('[TOTP] Secret length:', secret.length);
    console.log('[TOTP] Secret type:', typeof secret);

    // Validate input
    if (!secret || typeof secret !== 'string') {
        console.error('[TOTP] Invalid secret: not a string or empty');
        throw new Error('Invalid 2FA secret: must be a non-empty string');
    }

    // Clean and validate secret
    const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
    console.log('[TOTP] Cleaned secret:', cleanSecret);
    console.log('[TOTP] Cleaned secret length:', cleanSecret.length);

    // Validate Base32 format
    const base32Regex = /^[A-Z2-7]+=*$/;
    if (!base32Regex.test(cleanSecret)) {
        console.error('[TOTP] Invalid Base32 format. Secret contains invalid characters.');
        console.error('[TOTP] Valid characters: A-Z, 2-7, and optional = padding');
        throw new Error('Invalid 2FA secret format: must be valid Base32');
    }

    // Decode Base32 secret
    console.log('[TOTP] Decoding Base32...');
    const key = base32ToBuffer(cleanSecret);
    console.log('[TOTP] Decoded key length:', key.length);

    if (key.length === 0) {
        console.error('[TOTP] Decoded key is empty!');
        throw new Error('Invalid 2FA secret: decoding resulted in empty key');
    }

    // Calculate counter
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / windowSize);
    console.log('[TOTP] Epoch:', epoch, 'Counter:', counter);

    // Convert counter to buffer (8 bytes, big-endian)
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter, false); // Low 4 bytes
    counterView.setUint32(0, 0, false);       // High 4 bytes

    // HMAC-SHA1
    console.log('[TOTP] Importing crypto key...');
    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        key as any,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    console.log('[TOTP] Signing with HMAC-SHA1...');
    const signature = await window.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        counterBuffer
    );

    // Truncate
    const signatureArray = new Uint8Array(signature);
    const offset = signatureArray[signatureArray.length - 1] & 0xf;
    const binary =
        ((signatureArray[offset] & 0x7f) << 24) |
        ((signatureArray[offset + 1] & 0xff) << 16) |
        ((signatureArray[offset + 2] & 0xff) << 8) |
        (signatureArray[offset + 3] & 0xff);

    const otp = binary % 1000000;
    const result = otp.toString().padStart(6, '0');
    console.log('[TOTP] Generated OTP:', result);
    return result;
}

function base32ToBuffer(base32: string): Uint8Array {
    console.log('[Base32] Decoding:', base32);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = new Uint8Array((base32.length * 5) / 8 | 0);

    let validChars = 0;
    let invalidChars = 0;

    for (let i = 0; i < base32.length; i++) {
        const char = base32[i].toUpperCase();

        // Skip padding
        if (char === '=') continue;

        const val = alphabet.indexOf(char);
        if (val === -1) {
            console.warn(`[Base32] Invalid character at position ${i}: '${char}' (code: ${char.charCodeAt(0)})`);
            invalidChars++;
            continue;
        }

        validChars++;
        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 0xff;
            bits -= 8;
        }
    }

    console.log(`[Base32] Valid chars: ${validChars}, Invalid chars: ${invalidChars}`);
    console.log(`[Base32] Output buffer length: ${index}`);

    return output.slice(0, index);
}

export function getTOTPExpiration(windowSize = 30): number {
    const epoch = Math.floor(Date.now() / 1000);
    return windowSize - (epoch % windowSize);
}
