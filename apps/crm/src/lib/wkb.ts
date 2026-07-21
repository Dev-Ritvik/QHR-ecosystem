/**
 * Helper to parse Well-Known Binary (WKB) hex strings returned by Postgres driver
 * for PostGIS Point geometries.
 */
export function parseWkbPoint(wkbHex: string | null | undefined): GeoJSON.Point | null {
  if (!wkbHex) return null;
  
  try {
    const buf = Buffer.from(wkbHex, 'hex');
    const isLittleEndian = buf[0] === 1;
    
    // Geometry type = 1 for Point. SRID flag is 0x20000000.
    const type = isLittleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (type & 0x20000000) === 0x20000000;
    
    let offset = 5;
    if (hasSrid) offset += 4; // Skip SRID (usually 4326)
    
    const x = isLittleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    const y = isLittleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
    
    return {
      type: 'Point',
      coordinates: [x, y],
    };
  } catch (err) {
    console.error('Failed to parse WKB point:', err);
    return null;
  }
}

/**
 * Creates a PostGIS Extended Well-Known Text (EWKT) string for a Point.
 * Useful for inserting/updating PostGIS geometries via Drizzle without ST_MakePoint.
 */
export function toEwktPoint(lng: number, lat: number, srid = 4326): string {
  return `SRID=${srid};POINT(${lng} ${lat})`;
}
