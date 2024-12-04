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
  const contactsRef = useRef(contacts);

  // Update the ref whenever the contacts state changes
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

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
      fetchContacts();  // Fetch contacts once WebSocket is connected
    };

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
    
      if (data.messageType === 'ACK' || data.messageType === 'ERR') {
        const messageId = data.messageId;
        setConversations((prev) => ({
          ...prev,
          [data.to]: prev[data.to].map((conversationMessage) => {
            if (conversationMessage.messageId === messageId) {
              return {
                ...conversationMessage,
                type: data.messageType === 'ACK' ? 'sent' : 'failed'
              };
            }
            return conversationMessage;
          })
        }));
      }
      else if (data.from) {
        // Check if the sender is in the contacts list
        const sender = data.from;
        const senderExists = contactsRef.current.some(contact => contact.contactMobileNo === sender);
        if (!senderExists) {
          // If sender is not in the contact list, add them to the contact list
          try {
            // Call the backend to add the new contact
            const response = await fetch('http://localhost:8080/chat/addContact', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ mobileNo: myMobileNumber, contactMobileNo: sender, conversationKey: data.conversationKey }),
            });
    
            if (!response.ok) {
              alert('Failed to add contact')
              throw new Error('Failed to add contact');
            }
    
            // If the contact is added successfully, update the contacts list
            const addedContact = await response.json();
            setContacts((prevContacts) => [...prevContacts, addedContact]);
    
            console.log(`Added new contact: ${sender}`);
          } catch (error) {
            console.error('Error adding contact:', error);
          }
        }
    
        // Add the new message to the conversation list
        const messageType = sender === myMobileNumber ? 'sent' : 'received';
    
        setConversations(prev => ({
          ...prev,
          [sender]: [
            ...(prev[sender] || []),
            { sender: data.from, message: data.message, type: messageType, messageId: data.messageId }
          ]
        }));
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsRegistered(false);
    };
  };

  // Fetch contacts list from API
  const fetchContacts = async () => {
    try {
      const response = await fetch('http://localhost:8080/chat/getContact?mobileNo=' + myMobileNumber, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const contactsData = await response.json();
      setContacts(contactsData);  // Assuming response is an array of contacts
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchMessages = async (contact) => {
    try {
      const response = await fetch(`http://localhost:8080/chat/getMessages?conversationKey=${contact.conversationKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
  
      const messagesData = await response.json();
      
      // Update conversations state based on sender and receiver
      setConversations((prev) => {
        // Determine the conversation direction (sender vs receiver)
        const updatedMessages = messagesData.map(msg => ({
          ...msg,
          type: msg.sender === myMobileNumber ? 'sent' : 'received',
        }));
  
        // Add to existing conversation or create a new one
        return {
          ...prev,
          [contact.contactMobileNo]: updatedMessages,
        };
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };
  

  // Add a new contact
  const handleAddContact = async () => {
    if (!isValidMobileNumber(newContact)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    if (contacts.some(contact => contact.contactMobileNo === newContact)) {
      alert('Contact already exists');
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/chat/addContact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobileNo: myMobileNumber, contactMobileNo: newContact }),
      });

      if (!response.ok) {
        throw new Error('Failed to add contact');
      }

      const addedContact = await response.json();
      setContacts((prevContacts) => [...prevContacts, addedContact]);
      setNewContact('');
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  // Send message via WebSocket
  const handleSendMessage = () => {
    if (!message.trim() || !selectedContact) return;

    let uniqueId = generateUniqueId(myMobileNumber, selectedContact.contactMobileNo);

    const messageObj = {
      to: selectedContact.contactMobileNo,
      message: message,
      messageId: uniqueId,
      conversationKey: selectedContact.conversationKey
    };

    wsRef.current.send(JSON.stringify(messageObj));

    setConversations(prev => ({
      ...prev,
      [selectedContact.contactMobileNo]: [
        ...(prev[selectedContact.contactMobileNo] || []),
        { sender: 'Me', message: message, type: 'sending', messageId: uniqueId }
      ]
    }));

    setMessage('');
  };

  const generateUniqueId = (senderMobile, receiverMobile) => {
    const timestamp = Date.now();
    const randomComponent = Math.random().toString(36).substr(2, 9);
    return `${senderMobile}-${receiverMobile}-${timestamp}-${randomComponent}`;
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  // When a contact is selected, fetch the messages for that contact
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact);  // Fetch the messages from the server when contact is selected
    }
  }, [selectedContact]);

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
                  key={contact.contactMobileNo}
                  onClick={() => setSelectedContact(contact)}
                  className={`contact-item ${
                    (selectedContact && selectedContact.contactMobileNo === contact.contactMobileNo) ? 'selected' : ''
                  }`}
                >
                  {contact.contactMobileNo}
                </div>
              ))}
            </div>
          </div>

          {/* Chat Section */}
          <div className="chat-section">
            {selectedContact ? (
              <>
                <div className="chat-header">
                  <h2>Chat with {selectedContact.contactMobileNo}</h2>
                </div>
                <div className="messages-container">
                  {conversations[selectedContact.contactMobileNo]?.map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.type}`}
                    >
                      <div className="message-sender">{msg.sender==myMobileNumber ? 'Me' : msg.sender}</div>
                      <div className="message-content">{msg.message}</div>
                      {
                        (msg.type === 'sending' || msg.type === 'failed') &&
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
