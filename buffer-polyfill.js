// Buffer polyfill for browser environment
// This fixes the "Buffer is not defined" error when using Node.js-based libraries in browsers

if (typeof Buffer === 'undefined') {
    console.log('🔧 Installing Buffer polyfill for browser environment');
    
    class BufferPolyfill {
        constructor(data, encoding) {
            if (data instanceof Uint8Array) {
                this.data = data;
            } else if (typeof data === 'string') {
                this.data = this.fromString(data, encoding || 'utf8');
            } else if (typeof data === 'number') {
                this.data = new Uint8Array(data);
            } else if (Array.isArray(data)) {
                this.data = new Uint8Array(data);
            } else {
                this.data = new Uint8Array(0);
            }
            
            this.length = this.data.length;
        }
        
        static from(data, encoding) {
            return new BufferPolyfill(data, encoding);
        }
        
        static alloc(size, fill) {
            const buffer = new BufferPolyfill(size);
            if (fill !== undefined) {
                buffer.data.fill(typeof fill === 'string' ? fill.charCodeAt(0) : fill);
            }
            return buffer;
        }
        
        static allocUnsafe(size) {
            return new BufferPolyfill(size);
        }
        
        static isBuffer(obj) {
            return obj instanceof BufferPolyfill;
        }
        
        static concat(list, totalLength) {
            if (!Array.isArray(list)) {
                throw new Error('list argument must be an Array');
            }
            
            let length = 0;
            for (let i = 0; i < list.length; i++) {
                length += list[i].length;
            }
            
            if (totalLength !== undefined && totalLength < length) {
                length = totalLength;
            }
            
            const result = new Uint8Array(length);
            let pos = 0;
            
            for (let i = 0; i < list.length && pos < length; i++) {
                const item = list[i];
                const data = item instanceof BufferPolyfill ? item.data : new Uint8Array(item);
                const copyLength = Math.min(data.length, length - pos);
                result.set(data.subarray(0, copyLength), pos);
                pos += copyLength;
            }
            
            return new BufferPolyfill(result);
        }
        
        fromString(str, encoding) {
            switch (encoding) {
                case 'hex':
                    return this.fromHex(str);
                case 'base64':
                    return this.fromBase64(str);
                case 'utf8':
                case 'utf-8':
                default:
                    return new TextEncoder().encode(str);
            }
        }
        
        fromHex(hex) {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        }
        
        fromBase64(base64) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }
        
        toString(encoding) {
            switch (encoding) {
                case 'hex':
                    return Array.from(this.data)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                case 'base64':
                    return btoa(String.fromCharCode(...this.data));
                case 'utf8':
                case 'utf-8':
                default:
                    return new TextDecoder().decode(this.data);
            }
        }
        
        slice(start, end) {
            return new BufferPolyfill(this.data.slice(start, end));
        }
        
        subarray(start, end) {
            return new BufferPolyfill(this.data.subarray(start, end));
        }
        
        equals(other) {
            if (!(other instanceof BufferPolyfill)) return false;
            if (this.length !== other.length) return false;
            
            for (let i = 0; i < this.length; i++) {
                if (this.data[i] !== other.data[i]) return false;
            }
            return true;
        }
        
        copy(target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
            const source = this.data.slice(sourceStart, sourceEnd);
            if (target instanceof BufferPolyfill) {
                target.data.set(source, targetStart);
            } else if (target instanceof Uint8Array) {
                target.set(source, targetStart);
            }
            return source.length;
        }
        
        fill(value, offset = 0, end = this.length) {
            const fillValue = typeof value === 'string' ? value.charCodeAt(0) : value;
            this.data.fill(fillValue, offset, end);
            return this;
        }
        
        indexOf(value, byteOffset = 0) {
            const searchValue = typeof value === 'string' ? value.charCodeAt(0) : value;
            return this.data.indexOf(searchValue, byteOffset);
        }
        
        includes(value, byteOffset = 0) {
            return this.indexOf(value, byteOffset) !== -1;
        }
        
        readUInt8(offset) {
            return this.data[offset];
        }
        
        readUInt16BE(offset) {
            return (this.data[offset] << 8) | this.data[offset + 1];
        }
        
        readUInt16LE(offset) {
            return this.data[offset] | (this.data[offset + 1] << 8);
        }
        
        readUInt32BE(offset) {
            return (this.data[offset] << 24) | 
                   (this.data[offset + 1] << 16) | 
                   (this.data[offset + 2] << 8) | 
                   this.data[offset + 3];
        }
        
        readUInt32LE(offset) {
            return this.data[offset] | 
                   (this.data[offset + 1] << 8) | 
                   (this.data[offset + 2] << 16) | 
                   (this.data[offset + 3] << 24);
        }
        
        writeUInt8(value, offset) {
            this.data[offset] = value & 0xFF;
            return offset + 1;
        }
        
        writeUInt16BE(value, offset) {
            this.data[offset] = (value >>> 8) & 0xFF;
            this.data[offset + 1] = value & 0xFF;
            return offset + 2;
        }
        
        writeUInt16LE(value, offset) {
            this.data[offset] = value & 0xFF;
            this.data[offset + 1] = (value >>> 8) & 0xFF;
            return offset + 2;
        }
        
        writeUInt32BE(value, offset) {
            this.data[offset] = (value >>> 24) & 0xFF;
            this.data[offset + 1] = (value >>> 16) & 0xFF;
            this.data[offset + 2] = (value >>> 8) & 0xFF;
            this.data[offset + 3] = value & 0xFF;
            return offset + 4;
        }
        
        writeUInt32LE(value, offset) {
            this.data[offset] = value & 0xFF;
            this.data[offset + 1] = (value >>> 8) & 0xFF;
            this.data[offset + 2] = (value >>> 16) & 0xFF;
            this.data[offset + 3] = (value >>> 24) & 0xFF;
            return offset + 4;
        }
        
        // Make it iterable
        [Symbol.iterator]() {
            return this.data[Symbol.iterator]();
        }
        
        // Array-like access
        get(index) {
            return this.data[index];
        }
        
        set(index, value) {
            this.data[index] = value;
        }
    }
    
    // Add array-like indexing
    const handler = {
        get(target, prop) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                return target.data[parseInt(prop)];
            }
            return target[prop];
        },
        set(target, prop, value) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                target.data[parseInt(prop)] = value;
                return true;
            }
            target[prop] = value;
            return true;
        }
    };
    
    // Create proxied BufferPolyfill class for array-like access
    function Buffer(data, encoding) {
        const buffer = new BufferPolyfill(data, encoding);
        return new Proxy(buffer, handler);
    }
    
    // Copy static methods
    Object.setPrototypeOf(Buffer, BufferPolyfill);
    Buffer.from = BufferPolyfill.from;
    Buffer.alloc = BufferPolyfill.alloc;
    Buffer.allocUnsafe = BufferPolyfill.allocUnsafe;
    Buffer.isBuffer = BufferPolyfill.isBuffer;
    Buffer.concat = BufferPolyfill.concat;
    
    // Make it available globally
    window.Buffer = Buffer;
    globalThis.Buffer = Buffer;
    
    console.log('✅ Buffer polyfill installed successfully');
} else {
    console.log('🔍 Buffer already available, skipping polyfill');
}
