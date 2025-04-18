# LinkedIn Job Application Agent

This agent automatically applies to LinkedIn jobs that match a user's CV using GPT-4o mini to:
1. Analyze the CV for skills and experience
2. Search for relevant LinkedIn jobs
3. Evaluate job matches
4. Generate personalized cover letters
5. Apply to the best matches

## Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   Create a `.env` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

## Usage

Run the agent with:

```bash
python agent.py path/to/cv.txt [job_count]
```

Where:
- `path/to/cv.txt` is the path to the CV text file
- `job_count` is the optional number of jobs to apply for (default: 25)

## Integration

This agent is integrated with the CV Optimizer web application and accessed through the `/dashboard/apply` page, which:

1. Uses Stripe to charge $0.99 per batch of applications
2. Allows selection of an optimized CV
3. Configures the number of jobs to apply for
4. Provides a status page for application progress

## Implementation Notes

- Current implementation includes mock functions for LinkedIn interactions
- For production, replace mock functions with actual LinkedIn API calls or web automation
- The agent uses OpenAI's Agents SDK and GPT-4o mini for efficiency/cost balance 