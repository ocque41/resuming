import pytest
import os
from unittest.mock import patch, MagicMock
from agent_factory import AgentFactory

# Mock environment variables for testing
@pytest.fixture(autouse=True)
def mock_env_variables():
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-api-key"}):
        yield

# Mock the OpenAI client
@pytest.fixture
def mock_openai_client():
    with patch("agent_factory.openai_client") as mock_client:
        yield mock_client

# Mock the Agent class
@pytest.fixture
def mock_agent_class():
    with patch("agent_factory.Agent") as mock_agent:
        # Return a MagicMock when Agent is instantiated
        mock_instance = MagicMock()
        mock_agent.return_value = mock_instance
        yield mock_agent

def test_get_agent_analyzer(mock_agent_class):
    """Test getting an analyzer agent."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get an analyzer agent
    agent = AgentFactory.get_agent("analyze")
    
    # Check if Agent was called with correct parameters
    mock_agent_class.assert_called_once()
    call_args = mock_agent_class.call_args[1]
    
    # Verify the agent configuration
    assert call_args["name"] == "document_analyzer"
    assert "gpt-4o" in call_args["model"]
    assert call_args["tools"] is not None
    assert "document analyzer" in call_args["instructions"].lower()

def test_get_agent_editor(mock_agent_class):
    """Test getting an editor agent."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get an editor agent
    agent = AgentFactory.get_agent("edit")
    
    # Check if Agent was called with correct parameters
    mock_agent_class.assert_called_once()
    call_args = mock_agent_class.call_args[1]
    
    # Verify the agent configuration
    assert call_args["name"] == "document_editor"
    assert "gpt-4o" in call_args["model"]
    assert call_args["tools"] is not None
    assert "document editing" in call_args["instructions"].lower()

def test_get_agent_creator(mock_agent_class):
    """Test getting a creator agent."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get a creator agent
    agent = AgentFactory.get_agent("create")
    
    # Check if Agent was called with correct parameters
    mock_agent_class.assert_called_once()
    call_args = mock_agent_class.call_args[1]
    
    # Verify the agent configuration
    assert call_args["name"] == "document_creator"
    assert "gpt-4o" in call_args["model"]
    assert call_args["tools"] is not None
    assert "document creation" in call_args["instructions"].lower()

def test_get_agent_invalid():
    """Test getting an invalid agent type."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get an invalid agent
    agent = AgentFactory.get_agent("invalid_type")
    
    # Should return None for invalid type
    assert agent is None

def test_get_agent_caching(mock_agent_class):
    """Test that agents are cached."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get an analyzer agent twice
    agent1 = AgentFactory.get_agent("analyze")
    
    # Agent class should be called once
    assert mock_agent_class.call_count == 1
    
    # Get the same agent again
    agent2 = AgentFactory.get_agent("analyze")
    
    # Agent class should still be called only once (cached)
    assert mock_agent_class.call_count == 1
    
    # Both agents should be the same instance
    assert agent1 is agent2

def test_reset_agents(mock_agent_class):
    """Test resetting the agent cache."""
    # Clear any cached agents
    AgentFactory._agents = {}
    
    # Get an analyzer agent
    agent1 = AgentFactory.get_agent("analyze")
    
    # Reset the agents
    AgentFactory.reset_agents()
    
    # Get an analyzer agent again
    agent2 = AgentFactory.get_agent("analyze")
    
    # Agent class should be called twice (cache was reset)
    assert mock_agent_class.call_count == 2 