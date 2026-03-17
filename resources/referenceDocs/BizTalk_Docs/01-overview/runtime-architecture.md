> **Source:** https://learn.microsoft.com/en-us/biztalk/core/runtime-architecture

# Runtime Architecture

Before reviewing more detailed information about the various components in BizTalk Server, it is important that you have an understanding of how the components fit into the overall architecture of the product. The BizTalk Server runtime is built on a publish/subscribe architecture in which a message is published into the system, and then received by one or more active subscribers. Different flavors of this architecture exist, but the model implemented in BizTalk Server is often called *content-based publish/subscribe*.

In a content-based publish/subscribe model, subscribers specify the messages they want to receive using a set of criteria about the message. The message is evaluated at the time it is published, and all of the active subscribers with matching subscriptions (indicated by filter expressions) receive the message. As it applies to BizTalk Server, content-based is a bit of a misnomer, however, because the criteria used to build subscriptions do not have to come from the message content, and may include contextual information about the message as well. For details of the subscription mechanism, see [Publish and Subscribe Architecture](https://learn.microsoft.com/en-us/biztalk/core/publish-and-subscribe-architecture).

The sections that follow describe the various components of the BizTalk Server runtime architecture.

## In This Section

- [The BizTalk Server Message](https://learn.microsoft.com/en-us/biztalk/core/the-biztalk-server-message)
- [Lifecycle of a Message](https://learn.microsoft.com/en-us/biztalk/core/lifecycle-of-a-message)
- [Processing the Message](https://learn.microsoft.com/en-us/biztalk/core/processing-the-message)
- [Request-Response Messaging](https://learn.microsoft.com/en-us/biztalk/core/request-response-messaging)
- [The Messaging Engine](https://learn.microsoft.com/en-us/biztalk/core/the-messaging-engine)
- [Entities](https://learn.microsoft.com/en-us/biztalk/core/entities)
- [Artifacts](https://learn.microsoft.com/en-us/biztalk/core/artifacts)
- [Enterprise Single Sign-On (SSO)](https://learn.microsoft.com/en-us/biztalk/core/enterprise-single-sign-on-sso)
- [Business Rules Engine](https://learn.microsoft.com/en-us/biztalk/core/business-rules-engine)
- [BizTalk Assemblies](https://learn.microsoft.com/en-us/biztalk/core/biztalk-assemblies)
