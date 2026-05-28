import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Tool, SchemaType } from '@google/generative-ai';
import { CoreBridge } from '@/lib/core-bridge';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const coreBridge = new CoreBridge();

// Define tools for Gemini
const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'query_route',
        description: 'Queries the transit engine for optimal routes between two stations.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            origin: { type: SchemaType.STRING, description: 'The ID of the origin station.' },
            destination: { type: SchemaType.STRING, description: 'The ID of the destination station.' },
            departureTime: { type: SchemaType.NUMBER, description: 'Departure time in seconds from midnight.' }
          },
          required: ['origin', 'destination', 'departureTime']
        }
      },
      {
        name: 'get_stations',
        description: 'Returns a list of all available transit stations.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      }
    ]
  }
];

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      tools: tools,
      systemInstruction: {
        role: 'system',
        parts: [{
          text: `You are a high-precision tactical transit assistant for Metro Manila. 
          Your goal is to provide specific, actionable, and advanced advice for commuters with a SAFETY-FIRST mandate. 
          PRIORITIZE PEDESTRIAN INFRASTRUCTURE: Always direct users to use footbridges, overpasses, and pedestrian lanes when available. 
          ROAD WALKING: If walking along a road is necessary, remind users to stay safe and use the sidewalk.
          Use spatial language (e.g., "Northbound platform," "Exit 2 towards the landmark"). 
          Factor in local context like train congestion, weather, and safety. 
          When providing directions, be specific about distances and maneuvers (e.g., "In 200m, take the footbridge to cross safely").
          Keep your tone direct, helpful, and authoritative.`
        }]
      }
    });

    // Filter history to ensure it starts with a 'user' role
    // Gemini requires the first message in history to be 'user'
    let history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // If history starts with 'model', remove it (it's likely the initial greeting)
    if (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    const chat = model.startChat({
      history: history,
    });

    const lastMessage = messages[messages.length - 1].content;
    let result = await chat.sendMessage(lastMessage);
    let response = result.response;

    // Handle function calls
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const toolResults = [];

      for (const call of functionCalls) {
        if (call.name === 'query_route') {
          const { origin, destination, departureTime } = call.args as any;
          const routes = coreBridge.queryRoute(origin, destination, departureTime);
          toolResults.push({
            functionResponse: {
              name: 'query_route',
              response: { routes }
            }
          });
        } else if (call.name === 'get_stations') {
          const stations = coreBridge.getStations();
          toolResults.push({
            functionResponse: {
              name: 'get_stations',
              response: { stations }
            }
          });
        }
      }

      // Send the tool results back to Gemini to get the final text response
      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    return NextResponse.json({
      content: response.text(),
      role: 'assistant'
    });

  } catch (error: any) {
    console.error('[API_CHAT] Error:', error.message || error);
    return NextResponse.json({
      content: `I'm sorry, I encountered an error: ${error.message}`,
      role: 'assistant'
    }, { status: 500 });
  }
}
