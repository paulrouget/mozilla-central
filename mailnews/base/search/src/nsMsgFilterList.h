/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
 * Copyright (C) 1999 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */

#ifndef _nsMsgFilterList_H_
#define _nsMsgFilterList_H_

#include "nscore.h"
#include "nsIMsgFolder.h"
#include "nsIMsgFilterList.h"
#include "nsCOMPtr.h"
#include "nsISupportsArray.h"

////////////////////////////////////////////////////////////////////////////////////////
// The Msg Filter List is an interface designed to make accessing filter lists
// easier. Clients typically open a filter list and either enumerate the filters,
// or add new filters, or change the order around...
//
////////////////////////////////////////////////////////////////////////////////////////

class nsIMsgFilter;
class nsIOFileStream;
class nsMsgFilter;

typedef enum
{
	nsMsgFilterAttribNone,
	nsMsgFilterAttribVersion, 
	nsMsgFilterAttribLogging, 
	nsMsgFilterAttribName, 
	nsMsgFilterAttribEnabled, 
	nsMsgFilterAttribDescription, 
	nsMsgFilterAttribType,
	nsMsgFilterAttribScriptFile, 
	nsMsgFilterAttribAction, 
	nsMsgFilterAttribActionValue, 
	nsMsgFilterAttribCondition
}  nsMsgFilterFileAttrib;

class nsMsgFilterList : public nsIMsgFilterList
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGFILTERLIST
//should be generated by idl. commenting out
  //   static const nsIID& GetIID() { static nsIID iid = NS_IMSGFILTERLIST_IID; return iid; }

	nsMsgFilterList(nsIOFileStream *fileStream);
	virtual ~nsMsgFilterList();

	nsresult		Close();
	nsresult		LoadTextFilters();

	PRInt16			GetVersion() {return m_fileVersion;}

	// IO routines, used by filter object filing code.
	nsresult WriteIntAttr( nsMsgFilterFileAttrib attrib, int value);
	nsresult WriteStrAttr(nsMsgFilterFileAttrib attrib, nsCString &str);
	nsresult WriteBoolAttr(nsMsgFilterFileAttrib attrib, PRBool boolVal);
protected:
		// type-safe accessor when you really have to have an nsMsgFilter
		nsresult GetMsgFilterAt(PRUint32 filterIndex, nsMsgFilter **filter);
#ifdef DEBUG
		void Dump();
#endif
protected:
	nsresult SaveTextFilters();
	// file streaming methods
	char			ReadChar();
	PRBool			IsWhitespace(char ch);
	char			SkipWhitespace();
	PRBool			StrToBool(nsCString &str);
	char			LoadAttrib(nsMsgFilterFileAttrib &attrib);
	const char		*GetStringForAttrib(nsMsgFilterFileAttrib attrib);
	nsresult		LoadValue(nsCString &value);
	nsresult ParseCondition(nsCString &value);
		PRInt16		m_fileVersion;
		PRBool		m_loggingEnabled;
	nsCOMPtr <nsIMsgFolder>	m_folder;
	nsMsgFilter		*m_curFilter;	// filter we're filing in or out(?)
	const char		*m_filterFileName;
	nsIOFileStream	*m_fileStream;
	nsCOMPtr<nsISupportsArray> m_filters;

};

#endif



