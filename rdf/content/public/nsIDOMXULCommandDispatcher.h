/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */
/* AUTO-GENERATED. DO NOT EDIT!!! */

#ifndef nsIDOMXULCommandDispatcher_h__
#define nsIDOMXULCommandDispatcher_h__

#include "nsISupports.h"
#include "nsString.h"
#include "nsIScriptContext.h"

class nsIController;
class nsIDOMElement;
class nsIDOMNode;
class nsIControllers;

#define NS_IDOMXULCOMMANDDISPATCHER_IID \
 { 0xf3c50361, 0x14fe, 0x11d3, \
		{ 0xbf, 0x87, 0x0, 0x10, 0x5a, 0x1b, 0x6, 0x27 } } 

class nsIDOMXULCommandDispatcher : public nsISupports {
public:
  static const nsIID& GetIID() { static nsIID iid = NS_IDOMXULCOMMANDDISPATCHER_IID; return iid; }

  NS_IMETHOD    GetFocusedNode(nsIDOMNode** aFocusedNode)=0;
  NS_IMETHOD    SetFocusedNode(nsIDOMNode* aFocusedNode)=0;

  NS_IMETHOD    AddCommandUpdater(nsIDOMElement* aUpdater, const nsString& aEvents, const nsString& aTargets)=0;

  NS_IMETHOD    RemoveCommandUpdater(nsIDOMElement* aUpdater)=0;

  NS_IMETHOD    UpdateCommands(const nsString& aEventName)=0;

  NS_IMETHOD    GetControllerForCommand(const nsString& aCommand, nsIController** aReturn)=0;

  NS_IMETHOD    GetControllers(nsIControllers** aReturn)=0;
};


#define NS_DECL_IDOMXULCOMMANDDISPATCHER   \
  NS_IMETHOD    GetFocusedNode(nsIDOMNode** aFocusedNode);  \
  NS_IMETHOD    SetFocusedNode(nsIDOMNode* aFocusedNode);  \
  NS_IMETHOD    AddCommandUpdater(nsIDOMElement* aUpdater, const nsString& aEvents, const nsString& aTargets);  \
  NS_IMETHOD    RemoveCommandUpdater(nsIDOMElement* aUpdater);  \
  NS_IMETHOD    UpdateCommands(const nsString& aEventName);  \
  NS_IMETHOD    GetControllerForCommand(const nsString& aCommand, nsIController** aReturn);  \
  NS_IMETHOD    GetControllers(nsIControllers** aReturn);  \



#define NS_FORWARD_IDOMXULCOMMANDDISPATCHER(_to)  \
  NS_IMETHOD    GetFocusedNode(nsIDOMNode** aFocusedNode) { return _to GetFocusedNode(aFocusedNode); } \
  NS_IMETHOD    SetFocusedNode(nsIDOMNode* aFocusedNode) { return _to SetFocusedNode(aFocusedNode); } \
  NS_IMETHOD    AddCommandUpdater(nsIDOMElement* aUpdater, const nsString& aEvents, const nsString& aTargets) { return _to AddCommandUpdater(aUpdater, aEvents, aTargets); }  \
  NS_IMETHOD    RemoveCommandUpdater(nsIDOMElement* aUpdater) { return _to RemoveCommandUpdater(aUpdater); }  \
  NS_IMETHOD    UpdateCommands(const nsString& aEventName) { return _to UpdateCommands(aEventName); }  \
  NS_IMETHOD    GetControllerForCommand(const nsString& aCommand, nsIController** aReturn) { return _to GetControllerForCommand(aCommand, aReturn); }  \
  NS_IMETHOD    GetControllers(nsIControllers** aReturn) { return _to GetControllers(aReturn); }  \


extern "C" NS_DOM nsresult NS_InitXULCommandDispatcherClass(nsIScriptContext *aContext, void **aPrototype);

extern "C" NS_DOM nsresult NS_NewScriptXULCommandDispatcher(nsIScriptContext *aContext, nsISupports *aSupports, nsISupports *aParent, void **aReturn);

#endif // nsIDOMXULCommandDispatcher_h__
