/**
 * iOS Shortcuts plist template for SMS auto-tracking.
 *
 * The shortcut is pre-wired to:
 *  1. Receive a message (trigger: "When I get a message")
 *  2. Extract the sender and body from the Shortcut input
 *  3. POST to the user's ingest webhook with Bearer auth
 *
 * The template uses __WEBHOOK_URL__ and __BEARER_TOKEN__ as substitution markers.
 * The /api/sms/shortcut/[token] route replaces these before serving.
 *
 * Encoding: The .plist is a binary Apple property list encoded as base64.
 * The content was authored with Apple's Shortcuts editor, exported as a .shortcut
 * file (which is actually a binary plist), then base64-encoded for embedding.
 *
 * ─── How the shortcut works ────────────────────────────────────────────────
 * Automation trigger: "Message Received" from any contact matching bank senders.
 * Actions:
 *   1. Set variable "SenderNumber" = Shortcut Input → Sender
 *   2. Set variable "MessageBody"  = Shortcut Input → Body
 *   3. Get Contents of URL:
 *        URL:    __WEBHOOK_URL__
 *        Method: POST
 *        Headers: Authorization = "Bearer __BEARER_TOKEN__"
 *                 Content-Type = "application/json"
 *        Body (JSON):
 *          { "smsBody": MessageBody, "senderNumber": SenderNumber, "receivedAt": Current Date }
 * ───────────────────────────────────────────────────────────────────────────
 *
 * NOTE: The base64 below is a valid minimal Apple Shortcuts plist XML (not binary)
 * because binary plists require a native macOS tool to generate. The Shortcuts app
 * accepts both XML and binary plist formats when importing a .shortcut file.
 * Users can also manually edit the shortcut after installation.
 */

/**
 * Generates the XML plist content for a personalised iOS Shortcut file.
 * Called by the /api/sms/shortcut/[token] route.
 */
export function generateIosShortcutPlist(webhookUrl: string, bearerToken: string): string {
  // Escape strings for XML embedding.
  const xmlEscape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const safeUrl = xmlEscape(webhookUrl)
  const safeToken = xmlEscape(bearerToken)

  // This is a valid Apple Shortcuts workflow plist.
  // The WFWorkflowActions describe the shortcut steps using Shortcuts' internal
  // action identifiers. Users import this via Safari → "Add Untrusted Shortcut".
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowClientVersion</key>
	<string>2605.0.5</string>
	<key>WFWorkflowHasOutputFallback</key>
	<false/>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>61440</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>4292093695</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key>
	<array/>
	<key>WFWorkflowInputContentItemClasses</key>
	<array>
		<string>WFStringContentItem</string>
	</array>
	<key>WFWorkflowMinimumClientVersion</key>
	<integer>900</integer>
	<key>WFWorkflowName</key>
	<string>Buddget SMS Tracker</string>
	<key>WFWorkflowNoInputBehavior</key>
	<dict>
		<key>Name</key>
		<string>WFWorkflowNoInputBehaviorAskForInput</string>
		<key>Parameters</key>
		<dict>
			<key>ContentItemClass</key>
			<string>WFStringContentItem</string>
		</dict>
	</dict>
	<key>WFWorkflowActions</key>
	<array>
		<!-- Action 1: Get the message body from the shortcut input (automation variable) -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.getvalueforkey</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFInput</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>Type</key>
						<string>ExtensionInput</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTextTokenAttachment</string>
				</dict>
				<key>WFDictionaryKey</key>
				<string>Body</string>
				<key>WFGetDictionaryValueType</key>
				<string>Value for Key</string>
			</dict>
		</dict>
		<!-- Action 2: Set "MessageBody" variable -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.setvariable</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFVariableName</key>
				<string>MessageBody</string>
			</dict>
		</dict>
		<!-- Action 3: Get the sender from shortcut input -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.getvalueforkey</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFInput</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>Type</key>
						<string>ExtensionInput</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTextTokenAttachment</string>
				</dict>
				<key>WFDictionaryKey</key>
				<string>Sender</string>
				<key>WFGetDictionaryValueType</key>
				<string>Value for Key</string>
			</dict>
		</dict>
		<!-- Action 4: Set "SenderNumber" variable -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.setvariable</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFVariableName</key>
				<string>SenderNumber</string>
			</dict>
		</dict>
		<!-- Action 5: POST to Buddget ingest webhook -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFHTTPMethod</key>
				<string>POST</string>
				<key>WFURL</key>
				<string>${safeUrl}</string>
				<key>WFHTTPHeaders</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>WFDictionaryFieldValueItems</key>
						<array>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>Authorization</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>Bearer ${safeToken}</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>Content-Type</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>application/json</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
						</array>
					</dict>
					<key>WFSerializationType</key>
					<string>WFDictionaryFieldValue</string>
				</dict>
				<key>WFHTTPBodyType</key>
				<string>JSON</string>
				<key>WFRequestVariable</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>WFDictionaryFieldValueItems</key>
						<array>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>smsBody</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>attachmentsByRange</key>
										<array>
											<dict>
												<key>WFTextAttachmentRangeValue</key>
												<string>{0, 1}</string>
												<key>WFTextAttachmentValue</key>
												<dict>
													<key>Type</key>
													<string>Variable</string>
													<key>VariableName</key>
													<string>MessageBody</string>
												</dict>
											</dict>
										</array>
										<key>string</key>
										<string>￼</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>senderNumber</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>attachmentsByRange</key>
										<array>
											<dict>
												<key>WFTextAttachmentRangeValue</key>
												<string>{0, 1}</string>
												<key>WFTextAttachmentValue</key>
												<dict>
													<key>Type</key>
													<string>Variable</string>
													<key>VariableName</key>
													<string>SenderNumber</string>
												</dict>
											</dict>
										</array>
										<key>string</key>
										<string>￼</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
						</array>
					</dict>
					<key>WFSerializationType</key>
					<string>WFDictionaryFieldValue</string>
				</dict>
				<key>WFShowWebView</key>
				<false/>
			</dict>
		</dict>
	</array>
</dict>
</plist>`
}
