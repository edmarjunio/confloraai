// Keep the standard test command isolated from production runtime settings.
process.env.NODE_ENV = 'test';
process.env.REQUEST_AUTH_LIMIT ||= '10000';

// Banking regression tests explicitly opt into the automatic provider.
process.env.PIX_MODE ||= 'SICREDI';

process.env.PIX_KEY ||= '52998224725';
process.env.PIX_TITULAR ||= 'Loja de teste';
