/**
 * API Route: POST /api/cron/trigger
 * Endpoint chiamato dal cron job esterno ogni 60 minuti
 * 
 * Questo endpoint funziona come PROXY verso Lambda per mantenere
 * l'isolamento completo tra Vercel e OnlySocial.
 * 
 * Tutte le operazioni OnlySocial (upload, creazione post, schedulazione)
 * vengono eseguite da Lambda, non da Vercel.
 */

import { NextRequest, NextResponse } from 'next/server'

// Secret per autenticare le chiamate dal cron job
const CRON_SECRET = process.env.CRON_SECRET
const LAMBDA_API_URL = process.env.LAMBDA_API_URL

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('CRON JOB TRIGGERED - FORWARDING TO LAMBDA')
    console.log('Timestamp:', new Date().toISOString())

    // Verifica il secret per sicurezza
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    if (!CRON_SECRET) {
      console.error('CRON_SECRET non configurato')
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET not set' },
        { status: 500 }
      )
    }

    if (providedSecret !== CRON_SECRET) {
      console.error('Invalid cron secret')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!LAMBDA_API_URL) {
      console.error('LAMBDA_API_URL non configurato')
      return NextResponse.json(
        { error: 'Server configuration error: LAMBDA_API_URL not set' },
        { status: 500 }
      )
    }

    console.log('Cron job autenticato, forwarding to Lambda...')
    console.log('URL:', LAMBDA_API_URL)

    // Forward the request to Lambda
    const lambdaResponse = await fetch(LAMBDA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'schedule'
      }),
    })

    const lambdaData = await lambdaResponse.json()
    const executionTime = Date.now() - startTime

    if (!lambdaResponse.ok) {
      console.error('Lambda returned error:', lambdaData)
      return NextResponse.json(
        {
          success: false,
          error: lambdaData.error || 'Lambda execution failed',
          lambdaStatus: lambdaResponse.status,
          executionTime: executionTime + 'ms'
        },
        { status: lambdaResponse.status }
      )
    }

    console.log('Lambda execution completed successfully')
    console.log('Tempo di esecuzione:', executionTime + 'ms')

    return NextResponse.json({
      success: true,
      message: 'Cron job executed via Lambda',
      timestamp: new Date().toISOString(),
      executionTime: executionTime + 'ms',
      lambdaResponse: lambdaData
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error('Errore durante forward a Lambda:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to forward request to Lambda',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: executionTime + 'ms'
      },
      { status: 500 }
    )
  }
}

// Supporta anche GET per test manuali (solo in development)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Method not allowed in production' },
      { status: 405 }
    )
  }

  console.log('TEST CRON JOB (GET request)')
  
  return NextResponse.json({
    message: 'Cron endpoint is ready (Lambda proxy mode)',
    environment: process.env.NODE_ENV,
    lambdaUrl: LAMBDA_API_URL ? 'configured' : 'NOT CONFIGURED',
    note: 'Use POST with Authorization header in production',
    testUrl: request.nextUrl.origin + '/api/cron/trigger'
  })
}
