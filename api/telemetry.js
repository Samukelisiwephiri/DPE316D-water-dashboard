const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

function isValidTelemetry(data) {
  return (
    data !== null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof data.device_id === 'string' &&
    data.device_id.length > 0 &&
    data.device_id.length <= 64 &&
    isFiniteNumber(data.water_level_pct) &&
    data.water_level_pct >= 0 &&
    data.water_level_pct <= 100 &&
    isFiniteNumber(data.battery_v) &&
    data.battery_v >= 0 &&
    data.battery_v <= 20 &&
    [0, 1, false, true].includes(data.valve_state) &&
    [0, 1, false, true].includes(data.estop) &&
    typeof data.timestamp === 'string' &&
    Number.isFinite(Date.parse(data.timestamp)) &&
    (data.volume_litres === undefined ||
      (isFiniteNumber(data.volume_litres) && data.volume_litres >= 0)) &&
    (data.raw_adc_v === undefined ||
      (isFiniteNumber(data.raw_adc_v) && data.raw_adc_v >= 0))
  );
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type']
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  let telemetryData = req.body;
  if (typeof telemetryData === 'string') {
    try {
      telemetryData = JSON.parse(telemetryData);
    } catch {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
  }

  if (!isValidTelemetry(telemetryData)) {
    return res.status(400).json({ error: 'Invalid telemetry payload' });
  }

  return res.status(200).json({
    status: 'success',
    message: 'Telemetry received successfully',
    timestamp: new Date().toISOString(),
    receivedData: telemetryData,
  });
}
