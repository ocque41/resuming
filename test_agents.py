import os
import asyncio
from agents import Agent, Runner, set_default_openai_key

# Use the API key directly
api_key = "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"

# Configure the SDK with the API key
set_default_openai_key(api_key)

async def main():
    print("Creating agent...")
    agent = Agent(
        name="TestAssistant", 
        instructions="You are a helpful assistant that answers questions concisely."
    )
    
    print("Sending test message to agent...")
    result = await Runner.run(agent, "Hello! What can you do?")
    
    print("\nAgent response:")
    print("--------------")
    print(result.final_output)
    print("--------------")
    
    print("\nTest completed successfully!")

if __name__ == "__main__":
    asyncio.run(main()) 