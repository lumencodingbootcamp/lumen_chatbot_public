import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [myMobileNumber, setMyMobileNumber] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState({});
  const wsRef = useRef(null);
  const messageEndRef = useRef(null);

  // Validate 10-digit mobile number
  const isValidMobileNumber = (number) => /^\d{10}$/.test(number);

  // Initialize WebSocket connection
  const registerWebSocket = () => {
    if (!isValidMobileNumber(myMobileNumber)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    wsRef.current = new WebSocket(`ws://localhost:8080/chat/${myMobileNumber}`);
    
    wsRef.current.onopen = () => {
      setIsRegistered(true);
      console.log('WebSocket Connected');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.messageType == 'ACK' || data.messageType == 'ERR') {
        const messageId = data.messageId;
        console.log(data)
        setConversations(prev => {
          console.log('Previous Conversations:', prev);  // Debugging: log the previous conversations state
          return {
            ...prev,
            [data.to]: prev[data.to].map(conversationMessage => {
              if (conversationMessage.messageId === messageId) {
                return {
                  ...conversationMessage,
                  type: data.messageType == 'ACK' ? 'sent' : 'failed'
                };
              }
              return conversationMessage;
            })
          };
        });
      }
      else if (data.from) {
        setContacts(prevContacts => {
          if (!prevContacts.includes(data.from)) {
            return [...prevContacts, data.from];
          }
          return prevContacts;
        });
        setConversations(prev => ({
          ...prev,
          [data.from]: [
            ...(prev[data.from] || []),
            { sender: data.from, message: data.message, type: 'received', messageId: data.messageId }
          ]
        }));
      }
      console.log(conversations);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsRegistered(false);
    };
  };

  // Add new contact
  const handleAddContact = () => {
    if (!isValidMobileNumber(newContact)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    
    if (contacts.includes(newContact)) {
      alert('Contact already exists');
      return;
    }
    
    setContacts(prev => [...prev, newContact]);
    setNewContact('');
  };

  const generateUniqueId = (senderMobile, receiverMobile) => {
    const timestamp = Date.now();
    const randomComponent = Math.random().toString(36).substr(2, 9);
    return `${senderMobile}-${receiverMobile}-${timestamp}-${randomComponent}`;
  }

  // Send message
  const handleSendMessage = () => {
    if (!message.trim() || !selectedContact) return;

    let uniqueId = generateUniqueId(myMobileNumber, selectedContact);

    const messageObj = {
      to: selectedContact,
      message: message,
      messageId: uniqueId
    };

    wsRef.current.send(JSON.stringify(messageObj));

    setConversations(prev => ({
      ...prev,
      [selectedContact]: [
        ...(prev[selectedContact] || []),
        { sender: 'Me', message: message, type: 'sending', messageId: uniqueId }
      ]
    }));

    setMessage('');
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  return (
    <div className="chat-app">
      {!isRegistered &&
      <h1 className="chat-title">Chatbox</h1>
      }

      {isRegistered &&
      <h1 className="chat-title">Chatbox of {myMobileNumber}</h1>
      }
      
      {!isRegistered ? (
        <div className="registration-section">
          <input
            type="text"
            value={myMobileNumber}
            onChange={(e) => setMyMobileNumber(e.target.value)}
            placeholder="Enter your mobile number"
            maxLength={10}
            className="mobile-input"
          />
          <button onClick={registerWebSocket} className="register-btn">
            Register to Chat
          </button>
        </div>
      ) : (
        <div className="main-chat-container">
          {/* Contacts Section */}
          <div className="contacts-section">
            <h2>Contacts</h2>
            <div className="add-contact">
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="Enter mobile number"
                maxLength={10}
                className="contact-input"
              />
              <button onClick={handleAddContact} className="add-btn">
                Add Contact
              </button>
            </div>
            <div className="contacts-list">
              {contacts.map((contact) => (
                <div
                  key={contact}
                  onClick={() => setSelectedContact(contact)}
                  className={`contact-item ${
                    selectedContact === contact ? 'selected' : ''
                  }`}
                >
                  {contact}
                </div>
              ))}
            </div>
          </div>

          {/* Chat Section */}
          <div className="chat-section">
            {selectedContact ? (
              <>
                <div className="chat-header">
                  <h2>Chat with {selectedContact}</h2>
                </div>
                <div className="messages-container">
                  {conversations[selectedContact]?.map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.type}`}
                    >
                      <div className="message-sender">{msg.sender}</div>
                      <div className="message-content">{msg.message}</div>
                      {
                        (msg.type=='sending' || msg.type=='failed') &&
                        <div className="progress">{msg.type}</div>
                      }
                    </div>
                  ))}
                  <div ref={messageEndRef} />
                </div>
                <div className="message-input-section">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message"
                    className="message-input"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                  />
                  <button onClick={handleSendMessage} className="send-btn">
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="no-chat-selected">
                Select a contact to start chatting
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
