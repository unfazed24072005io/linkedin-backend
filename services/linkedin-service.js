const puppeteer = require('puppeteer');

class LinkedInService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isScrapingActive = false;
    this.isLoggedIn = false;
  }

  // Open browser for manual login
  async openBrowserForLogin() {
    if (this.browser) {
      await this.browser.close();
    }

    this.browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized', '--no-sandbox', '--disable-notifications']
    });
    
    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();
    
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);
    
    // Navigate to LinkedIn login
    await this.page.goto('https://www.linkedin.com/login', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('Browser opened for manual login');
    return { 
      success: true, 
      message: 'Please login manually in the browser window, then start scraping' 
    };
  }

  // Start automated scraping AFTER manual login
  async startScrapingAfterLogin(filters) {
    if (!this.browser || !this.page) {
      throw new Error('Please open browser and login first');
    }

    if (this.isScrapingActive) {
      throw new Error('Scraping already in progress');
    }

    this.isScrapingActive = true;
    const leads = [];
    
    try {
      console.log(`Starting automated scraping: ${filters.jobTitle} in ${filters.location}`);
      
      // Check if user is logged in
      const isLoggedIn = await this.checkLoginStatus();
      if (!isLoggedIn) {
        throw new Error('Please login to LinkedIn first in the browser window');
      }

      // EXACT SAME SCRAPING LOGIC AS YOUR ORIGINAL
      const searchUrl = this.generateSearchUrl(filters);
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await this.delay(3000);
      
      let currentPage = 1;
      while (leads.length < filters.maxLeads && this.isScrapingActive && currentPage <= 5) {
        console.log(`Processing page ${currentPage}`);
        
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
        
        const pageLeads = await this.extractPageLeads(filters.location);
        
        if (pageLeads.length > 0) {
          console.log(`Found ${pageLeads.length} leads on page ${currentPage}`);
          
          // Enrich with Apollo data
          const enrichedLeads = await this.enrichWithApolloData(pageLeads);
          leads.push(...enrichedLeads);
          
          if (currentPage === 1 && pageLeads[0]) {
            console.log(`Sample lead: ${pageLeads[0].name} - ${pageLeads[0].title}`);
          }
          
          if (leads.length >= filters.maxLeads) {
            console.log(`Reached target of ${filters.maxLeads} leads`);
            break;
          }
        }
        
        const hasNextPage = await this.goToNextPage();
        if (!hasNextPage) {
          console.log('No more pages available');
          break;
        }
        
        currentPage++;
        await this.delay(3000);
      }
      
      this.isScrapingActive = false;
      
      // Clean and return leads (EXACT SAME AS YOUR ORIGINAL)
      const cleanedLeads = this.cleanExtractedData(leads.slice(0, filters.maxLeads));
      return cleanedLeads;
      
    } catch (error) {
      this.isScrapingActive = false;
      throw error;
    }
  }

  // Check if user is logged in
  async checkLoginStatus() {
    try {
      const currentUrl = this.page.url();
      if (currentUrl.includes('linkedin.com/feed') || 
          currentUrl.includes('linkedin.com/search') ||
          !currentUrl.includes('login')) {
        this.isLoggedIn = true;
        return true;
      }
      
      // Check for login elements
      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input#username') && !document.querySelector('input#password');
      });
      
      this.isLoggedIn = isLoggedIn;
      return isLoggedIn;
    } catch (error) {
      return false;
    }
  }

  // EXACT SAME EXTRACTION LOGIC AS YOUR ORIGINAL
  async extractPageLeads(defaultLocation) {
    return await this.page.evaluate((userLocation) => {
      const leads = [];
      const containers = document.querySelectorAll('[data-view-name="people-search-result"], .reusable-search__result-container, .entity-result__item');
      
      containers.forEach((container) => {
        try {
          const text = container.textContent || '';
          if (text.length < 30) return;
          
          // EXTRACT NAME - EXACT SAME AS YOUR ORIGINAL
          let name = 'Not Available';
          const nameSelectors = [
            '.entity-result__title-text a span[aria-hidden="true"]',
            '.artdeco-entity-lockup__title a',
            '.actor-name',
            '.search-result__title'
          ];
          
          for (const selector of nameSelectors) {
            const nameElement = container.querySelector(selector);
            if (nameElement && nameElement.textContent) {
              const nameText = nameElement.textContent.trim();
              if (nameText && nameText !== 'LinkedIn Member' && nameText.split(' ').length >= 2) {
                name = nameText;
                break;
              }
            }
          }
          
          if (name === 'Not Available') {
            const nameMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
            if (nameMatch && nameMatch[1] !== 'LinkedIn Member') {
              name = nameMatch[1];
            }
          }
          
          if (name === 'Not Available' || name === 'LinkedIn Member') return;
          
          // EXTRACT PROFILE URL - EXACT SAME
          let profileUrl = 'Not Available';
          const link = container.querySelector('a[href*="/in/"]');
          if (link) {
            const href = link.getAttribute('href');
            profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
          }
          
          // EXTRACT TITLE - EXACT SAME
          let title = 'Not Available';
          const titleElement = container.querySelector('.entity-result__primary-subtitle');
          if (titleElement) {
            title = titleElement.textContent.trim();
          } else {
            const titleMatch = text.match(/(.*?)(?= at |, |·|Current:|$)/);
            if (titleMatch) {
              const potentialTitle = titleMatch[1].trim();
              if (potentialTitle && potentialTitle !== name && !potentialTitle.includes('LinkedIn')) {
                title = potentialTitle;
              }
            }
          }
          
          // EXTRACT COMPANY - EXACT SAME
          let company = 'Not Available';
          const companyElement = container.querySelector('.entity-result__secondary-subtitle');
          if (companyElement) {
            company = companyElement.textContent.trim();
          } else {
            const atIndex = text.indexOf(' at ');
            if (atIndex > -1) {
              const afterAt = text.substring(atIndex + 4);
              const companyEnd = afterAt.search(/[,\n·]|Current:/);
              company = companyEnd > -1 ? afterAt.substring(0, companyEnd).trim() : afterAt.trim();
            }
          }
          
          // EXTRACT LOCATION - EXACT SAME
          let location = userLocation;
          const locationElement = container.querySelector('.entity-result__tertiary-subtitle');
          if (locationElement) {
            location = locationElement.textContent.split('·')[0].trim();
          } else {
            const locationMatch = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:, [A-Z][a-z]+(?: [A-Z][a-z]+)*)+)/);
            if (locationMatch) location = locationMatch[1].trim();
          }
          
          // CLEAN DATA - EXACT SAME
          if (title.includes('Current:')) title = title.replace('Current:', '').trim();
          if (company.includes('Current:')) company = company.replace('Current:', '').trim();
          location = location.split('·')[0].trim();
          
          // ADD LEAD - EXACT SAME
          if (title !== 'Not Available' || company !== 'Not Available') {
            leads.push({
              name: name,
              title: title,
              company: company,
              location: location,
              profileUrl: profileUrl,
              email: 'Not available',
              phone: 'Not available'
            });
          }
          
        } catch (error) {
          console.log('Error processing container:', error);
        }
      });
      
      return leads;
    }, defaultLocation);
  }

  // EXACT SAME APOLLO ENRICHMENT AS YOUR ORIGINAL
  async enrichWithApolloData(leads) {
    const enrichedLeads = [];
    
    for (const lead of leads) {
      try {
        if (!lead.profileUrl || lead.profileUrl.includes('N/A') || lead.profileUrl.includes('Not Available')) {
          enrichedLeads.push(lead);
          continue;
        }

        console.log(`Enriching contact info for: ${lead.name}`);
        
        // Navigate to profile page
        await this.page.goto(lead.profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        
        // Wait for page to load and Apollo extension to populate data
        await this.delay(3000);
        
        // Scroll to trigger lazy-loaded content
        await this.page.evaluate(() => window.scrollBy(0, 300));
        await this.delay(1000);
        
        // Extract Apollo data
        const apolloData = await this.extractApolloData();
        
        // Merge Apollo data with lead data
        const enrichedLead = {
          ...lead,
          email: apolloData.email,
          phone: apolloData.phone
        };
        
        enrichedLeads.push(enrichedLead);
        
        // Log success if we found contact info
        if (apolloData.email !== 'Not available' || apolloData.phone !== 'Not available') {
          console.log(`✓ Found contact info for ${lead.name}: ${apolloData.email} | ${apolloData.phone}`);
        } else {
          console.log(`✗ No contact info found for ${lead.name}`);
        }
        
        // Go back to search results
        await this.page.goBack();
        await this.delay(2000);
        
      } catch (error) {
        console.log(`Failed to enrich ${lead.name}: ${error.message}`);
        enrichedLeads.push(lead);
      }
    }
    
    return enrichedLeads;
  }

  // EXACT SAME APOLLO EXTRACTION AS YOUR ORIGINAL
  async extractApolloData() {
    return await this.page.evaluate(() => {
      const apolloData = {
        email: 'Not available',
        phone: 'Not available'
      };

      // METHOD 1: Look for Apollo extension overlay or popup
      const apolloSelectors = [
        '.apollo-email',
        '.apollo-phone', 
        '[data-apollo]',
        '[data-testid="apollo-email"]',
        '[data-testid="apollo-phone"]',
        '.ci-email',
        '.ci-phone',
        '.contact-info',
        '.pv-contact-info'
      ];

      for (const selector of apolloSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent || element.innerText || '';
          
          // Extract email
          const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i);
          if (emailMatch && apolloData.email === 'Not available') {
            apolloData.email = emailMatch[0];
          }
          
          // Extract phone
          const phoneMatch = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
          if (phoneMatch && apolloData.phone === 'Not available') {
            apolloData.phone = phoneMatch[0];
          }
        }
      }

      // METHOD 2: Check for contact info in the entire page body
      if (apolloData.email === 'Not available' || apolloData.phone === 'Not available') {
        const bodyText = document.body.textContent || '';
        
        // Look for emails in body
        const emailMatches = bodyText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi);
        if (emailMatches && emailMatches.length > 0) {
          // Filter out common LinkedIn emails and take the first valid one
          const validEmails = emailMatches.filter(email => 
            !email.includes('linkedin.com') && 
            !email.includes('no-reply') &&
            !email.includes('noreply')
          );
          if (validEmails.length > 0) {
            apolloData.email = validEmails[0];
          }
        }
        
        // Look for phones in body
        const phoneMatches = bodyText.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
        if (phoneMatches && phoneMatches.length > 0) {
          // Take the first phone that looks like a real number
          const validPhones = phoneMatches.filter(phone => 
            phone.replace(/\D/g, '').length >= 10
          );
          if (validPhones.length > 0) {
            apolloData.phone = validPhones[0];
          }
        }
      }

      return apolloData;
    });
  }

  // EXACT SAME CLEANING FUNCTIONS AS YOUR ORIGINAL
  cleanExtractedData(leads) {
    return leads.map(lead => {
      return {
        name: this.cleanName(lead.name),
        title: this.cleanTitle(lead.title),
        company: this.cleanCompany(lead.company),
        location: this.cleanLocation(lead.location),
        profileUrl: lead.profileUrl,
        email: this.cleanContactInfo(lead.email),
        phone: this.cleanContactInfo(lead.phone)
      };
    });
  }

  cleanName(name) {
    if (name === 'N/A' || name === 'LinkedIn Member') return 'Not Available';
    return name.replace(/\s+/g, ' ').trim();
  }

  cleanTitle(title) {
    if (title === 'N/A') return 'Not Available';
    let cleaned = title.replace(/\s+/g, ' ').trim();
    if (cleaned.includes(' at ') && !cleaned.includes('N/A')) {
      const parts = cleaned.split(' at ');
      if (parts.length > 1) return parts[0].trim();
    }
    return cleaned;
  }

  cleanCompany(company) {
    if (company === 'N/A') return 'Not Available';
    let cleaned = company.replace(/\s+/g, ' ').trim();
    if (cleaned.includes(' at ')) {
      const parts = cleaned.split(' at ');
      if (parts.length > 1) return parts[1].trim();
    }
    return cleaned;
  }

  cleanLocation(location) {
    if (location === 'N/A') return 'Not Available';
    let cleaned = location.replace(/\s+/g, ' ').trim();
    const locationParts = cleaned.split(',').map(part => part.trim());
    if (locationParts.length > 2) return locationParts.slice(0, 2).join(', ');
    return cleaned;
  }

  cleanContactInfo(contact) {
    if (contact === 'N/A' || contact === 'Not available') return 'Not available';
    return contact.replace(/\s+/g, ' ').trim();
  }

  generateSearchUrl(filters) {
    const locationCode = this.getLocationCode(filters.location);
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(filters.jobTitle)}&geoUrn=%5B%22${locationCode}%22%5D`;
  }

  getLocationCode(location) {
    // EXACT SAME LOCATION MAPPING AS YOUR ORIGINAL
    const locationMap = {
      'united states': '103644278', 'usa': '103644278', 'us': '103644278',
      'california': '102593603', 'new york': '100630339', 'texas': '103980366',
      'florida': '104035573', 'illinois': '102319083', 'pennsylvania': '102748354',
      'ohio': '103232215', 'georgia': '104766914', 'north carolina': '103973543',
      'michigan': '101748185', 'new jersey': '104034105', 'virginia': '103236371',
      'washington': '104079105', 'arizona': '102966764', 'massachusetts': '100567043',
      'tennessee': '100446193', 'indiana': '100428013', 'missouri': '100443995',
      'maryland': '103236371', 'wisconsin': '104079105', 'colorado': '103112571',
      'minnesota': '101748185', 'south carolina': '103973543', 'alabama': '104766914',
      'louisiana': '104035573', 'kentucky': '100446193', 'oregon': '104079105',
      'oklahoma': '103980366', 'connecticut': '100630339', 'iowa': '100428013',
      'utah': '103112571', 'nevada': '102966764', 'arkansas': '104035573',
      'mississippi': '104766914', 'kansas': '100443995', 'new mexico': '102966764',
      'nebraska': '100428013', 'west virginia': '103236371', 'idaho': '104079105',
      'hawaii': '102593603', 'new hampshire': '100567043', 'maine': '100567043',
      'montana': '104079105', 'rhode island': '100630339', 'delaware': '104034105',
      'south dakota': '100428013', 'north dakota': '100428013', 'alaska': '102593603',
      'vermont': '100567043', 'wyoming': '104079105',
      'new york city': '90000070', 'los angeles': '90000068', 'chicago': '90000049',
      'houston': '90000059', 'phoenix': '90000084', 'philadelphia': '90000082',
      'san antonio': '90000089', 'san diego': '90000090', 'dallas': '90000052',
      'san jose': '90000091', 'austin': '90000042', 'jacksonville': '90000061',
      'fort worth': '90000056', 'columbus': '90000050', 'charlotte': '90000047',
      'san francisco': '90000088', 'indianapolis': '90000060', 'seattle': '90000095',
      'denver': '90000053', 'washington dc': '90000098', 'boston': '90000045',
      'canada': '101174742', 'uk': '101165590', 'united kingdom': '101165590',
      'india': '102713980', 'australia': '101452733', 'germany': '101282230',
      'france': '105015875', 'brazil': '106057199', 'italy': '103350119',
      'spain': '105646813', 'netherlands': '102890719', 'switzerland': '106693272',
      'london': '102257872', 'toronto': '100025096', 'sydney': '101452733',
      'melbourne': '101452733', 'vancouver': '100025096', 'montreal': '100025096',
      'berlin': '101282230', 'paris': '105015875', 'amsterdam': '102890719',
      'rome': '103350119', 'madrid': '105646813', 'barcelona': '105646813',
      'dublin': '104738515', 'mumbai': '102713980', 'delhi': '102713980',
      'bangalore': '102713980', 'tokyo': '101355337', 'singapore': '102454443',
      'dubai': '104305776'
    };
    
    const normalizedLocation = location.toLowerCase().trim();
    
    if (locationMap[normalizedLocation]) {
      return locationMap[normalizedLocation];
    }
    
    for (const [key, code] of Object.entries(locationMap)) {
      if (normalizedLocation.includes(key) || key.includes(normalizedLocation)) {
        return code;
      }
    }
    
    return '103644278';
  }

  async goToNextPage() {
    try {
      return await this.page.evaluate(() => {
        const nextBtn = document.querySelector('button[aria-label="Next"]');
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          return true;
        }
        return false;
      });
    } catch (error) {
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stopScraping() {
    this.isScrapingActive = false;
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = new LinkedInService();